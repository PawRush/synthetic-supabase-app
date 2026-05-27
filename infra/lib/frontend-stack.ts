import * as cdk from 'aws-cdk-lib/core';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import { Construct } from 'constructs';

export class FrontendStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const deploymentId: string = this.node.tryGetContext('deploymentId') ?? 'default';

    // S3 bucket — private, auto-delete on removal
    const siteBucket = new s3.Bucket(this, 'SiteBucket', {
      bucketName: `frontend-${deploymentId}-${this.account}-${this.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // CloudFront Function for SPA routing (append /index.html)
    const spaRoutingFunction = new cloudfront.Function(this, 'SpaRoutingFunction', {
      functionName: `spa-routing-${deploymentId}`,
      code: cloudfront.FunctionCode.fromInline(`
function handler(event) {
  var request = event.request;
  var uri = request.uri;
  // If the URI has no file extension (not a static asset), serve index.html
  if (!uri.includes('.') || uri.endsWith('/')) {
    request.uri = '/index.html';
  }
  return request;
}
      `.trim()),
      runtime: cloudfront.FunctionRuntime.JS_2_0,
    });

    // Origin Access Control for S3
    const oac = new cloudfront.S3OriginAccessControl(this, 'OAC', {
      originAccessControlName: `frontend-oac-${deploymentId}`,
      signing: cloudfront.Signing.SIGV4_NO_OVERRIDE,
    });

    // CloudFront distribution
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultRootObject: 'index.html',
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(siteBucket, {
          originAccessControl: oac,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        functionAssociations: [
          {
            function: spaRoutingFunction,
            eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
          },
        ],
      },
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    // Outputs
    new cdk.CfnOutput(this, 'BucketName', {
      value: siteBucket.bucketName,
      exportName: `${id}-BucketName`,
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: distribution.distributionId,
      exportName: `${id}-DistributionId`,
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
      exportName: `${id}-DistributionDomainName`,
    });
  }
}
