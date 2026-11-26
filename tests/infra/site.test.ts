/// <reference types="node" />
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { CONTENT_SECURITY_POLICY } from '../../vite.config';

type Node = Record<string, any>;
const template = parse(readFileSync(new URL('../../infra/site.yml', import.meta.url), 'utf8')) as Node;
const workflow = parse(readFileSync(new URL('../../.github/workflows/deploy.yml', import.meta.url), 'utf8')) as Node;
const resource = (name: string) => template.Resources[name] as Node;
const props = (name: string) => resource(name).Properties as Node;
const DOMAIN = template.Parameters.DomainName.Default as string;
const sub = (s: string) => s.replaceAll('${DomainName}', DOMAIN);

describe('the site’s hosting', () => {
  // @spec UI-HOST-001
  it('serves a private bucket only through the distribution, over HTTPS, under both names with a certificate for both', () => {
    expect(props('SiteBucket').PublicAccessBlockConfiguration).toEqual({ BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true });
    const statements = props('SiteBucketPolicy').PolicyDocument.Statement as Node[];
    const allows = statements.filter((s) => s.Effect === 'Allow');
    expect(allows).toHaveLength(1);
    expect(allows[0]).toMatchObject({ Principal: { Service: 'cloudfront.amazonaws.com' }, Action: 's3:GetObject' });
    expect(JSON.stringify(allows[0]!.Condition)).toContain('distribution/${Distribution}');
    expect(statements.find((s) => s.Effect === 'Deny')).toMatchObject({ Action: 's3:*', Condition: { Bool: { 'aws:SecureTransport': 'false' } } });
    const config = props('Distribution').DistributionConfig as Node;
    expect(config.DefaultCacheBehavior.ViewerProtocolPolicy).toBe('redirect-to-https');
    expect(config.Aliases).toEqual([{ 'Fn::Sub': 'www.${DomainName}' }, { Ref: 'DomainName' }]);
    expect(config.Origins[0].OriginAccessControlId).toBeDefined();
    expect(props('Certificate')).toMatchObject({ DomainName: { 'Fn::Sub': 'www.${DomainName}' }, SubjectAlternativeNames: [{ Ref: 'DomainName' }], ValidationMethod: 'DNS' });
  });

  // @spec UI-HOST-002
  it('sends the game’s policy with frame-ancestors, nosniff, frame denial, a year of HSTS and no referrer', () => {
    expect(template.Parameters.ContentSecurityPolicy.Default).toBe(`${CONTENT_SECURITY_POLICY}; frame-ancestors 'none'`);
    const headers = props('SecurityHeaders').ResponseHeadersPolicyConfig.SecurityHeadersConfig as Node;
    expect(headers.ContentSecurityPolicy).toEqual({ ContentSecurityPolicy: { Ref: 'ContentSecurityPolicy' }, Override: true });
    expect(headers.ContentTypeOptions).toEqual({ Override: true });
    expect(headers.FrameOptions).toEqual({ FrameOption: 'DENY', Override: true });
    expect(headers.ReferrerPolicy).toEqual({ ReferrerPolicy: 'no-referrer', Override: true });
    expect(headers.StrictTransportSecurity.AccessControlMaxAgeSec).toBeGreaterThanOrEqual(31536000);
    expect(props('Distribution').DistributionConfig.DefaultCacheBehavior.ResponseHeadersPolicyId).toEqual({ Ref: 'SecurityHeaders' });
  });

  // @spec UI-HOST-003
  it('redirects the bare domain to the same path and query on www, and passes www through', () => {
    const code = sub(props('ApexRedirect').FunctionCode['Fn::Sub'] as string);
    const handler = runInNewContext(`${code}; handler`) as (event: Node) => Node;
    const request = (host: string, uri: string, querystring: Node = {}) => ({ request: { headers: { host: { value: host } }, uri, querystring } });
    expect(handler(request(DOMAIN, '/assets/x.js', { seed: { value: '7' }, debug: { value: '' } }))).toEqual({
      statusCode: 301,
      statusDescription: 'Moved Permanently',
      headers: { location: { value: `https://www.${DOMAIN}/assets/x.js?seed=7&debug` } },
    });
    expect(handler(request(DOMAIN, '/'))).toMatchObject({ statusCode: 301, headers: { location: { value: `https://www.${DOMAIN}/` } } });
    const www = request(`www.${DOMAIN}`, '/');
    expect(handler(www)).toBe(www.request);
  });

  // @spec UI-HOST-004
  it('gives the deploy a role trusted only for main, allowed only to write the bucket and invalidate the distribution', () => {
    const role = props('DeployRole');
    const trust = role.AssumeRolePolicyDocument.Statement as Node[];
    expect(trust).toHaveLength(1);
    expect(trust[0]).toMatchObject({ Action: 'sts:AssumeRoleWithWebIdentity', Principal: { Federated: { Ref: 'GitHubOidc' } } });
    expect(trust[0]!.Condition.StringEquals).toEqual({ 'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com', 'token.actions.githubusercontent.com:sub': { 'Fn::Sub': 'repo:${Repository}:ref:refs/heads/main' } });
    // The repository uses GitHub's immutable subject: owner and repository each named with its id.
    expect(template.Parameters.Repository.Default).toBe('twelve-chairs@56702533/manager-simulator@1454409896');
    const allowed = (role.Policies as Node[]).flatMap((p) => p.PolicyDocument.Statement as Node[]);
    expect(allowed.map((s) => s.Action)).toEqual(['s3:ListBucket', ['s3:PutObject', 's3:DeleteObject'], 'cloudfront:CreateInvalidation']);
    // Each permission names the site's own bucket or distribution: none applies to every resource.
    for (const s of allowed) expect(s.Resource).not.toBe('*');
  });

  // @spec UI-HOST-005
  it('says in DNS that the domain sends no mail, and lets only Amazon issue its certificates', () => {
    const records = props('NoMailAndCaa').RecordSets as Node[];
    const of = (type: string, name: unknown) => records.find((r) => r.Type === type && JSON.stringify(r.Name) === JSON.stringify(name))?.ResourceRecords;
    expect(of('MX', { Ref: 'DomainName' })).toEqual(['0 .']);
    expect(of('TXT', { Ref: 'DomainName' })).toEqual(['"v=spf1 -all"']);
    expect(of('TXT', { 'Fn::Sub': '_dmarc.${DomainName}' })?.[0]).toMatch(/^"v=DMARC1; p=reject;/);
    expect(of('CAA', { Ref: 'DomainName' })).toEqual(['0 issue "amazon.com"', '0 issuewild ";"']);
  });

  // @spec UI-HOST-006
  it('deploys main to the bucket, built for the root, the page uncached and assets for a year, then invalidates the page', () => {
    const job = workflow.jobs.site as Node;
    expect(job.needs).toBe('build');
    expect(job.if).toContain("github.ref == 'refs/heads/main'");
    expect(job.permissions).toEqual({ contents: 'read', 'id-token': 'write' });
    const runs = (job.steps as Node[]).map((s) => s.run ?? '').join('\n');
    expect(runs).toMatch(/^npm run build$/m);
    expect(runs).toContain('aws s3 sync dist "s3://$SITE_BUCKET" --delete --exclude index.html --cache-control "public, max-age=31536000, immutable"');
    expect(runs).toContain('aws s3 cp dist/index.html "s3://$SITE_BUCKET/index.html" --cache-control "no-cache"');
    expect(runs).toContain('create-invalidation');
    const login = (job.steps as Node[]).find((s) => String(s.uses).startsWith('aws-actions/configure-aws-credentials@'))!;
    expect(login.uses).toMatch(/@[0-9a-f]{40}$/);
    expect(login.with['role-to-assume']).toBe('${{ secrets.AWS_DEPLOY_ROLE_ARN }}');
  });
});
