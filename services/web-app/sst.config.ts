import { Tags } from "aws-cdk-lib";
import { SSTConfig } from "sst";
import { Config, NextjsSite, Table, use } from "sst/constructs";
import { getStage } from '../core/helpers';

export default {
  config(_input) {
    return {
      name: "web-app",
      region: "eu-west-2",
    };
  },
  stacks(app) {
    app.setDefaultFunctionProps({
      architecture: "arm_64",
      runtime: "nodejs18.x",
    });
    app.stack(function Site({ stack }) {
      const GITHUB_ID = new Config.Secret(stack, "GITHUB_ID");
      const GITHUB_SECRET = new Config.Secret(stack, "GITHUB_SECRET");

      //const userTable = use(UserEntity);
      const table = new Table(stack, "user-data", {
        fields: {
          pk: "string",
          sk: "string",
          GSI1PK: "string",
          GSI1SK: "string",
        },
        primaryIndex: { partitionKey: "pk", sortKey: "sk" },
        globalIndexes: {
          GSI1: { partitionKey: "GSI1PK", sortKey: "GSI1SK" },
        },
        stream: "new_image",
        consumers: {
          consumer1: {
            function: {
              handler: "src/functions/add-user/index.main",
              permissions: ["dynamodb"],
              environment: {
                STAGE: getStage(),
              }
            },
            filters: [
              {
                dynamodb: {
                  NewImage: {
                    type: {
                      S: ["USER"],
                    },
                  },
                },
              },
            ],
          }
        }
      });

      const site = new NextjsSite(stack, "site", {
        bind: [GITHUB_ID, GITHUB_SECRET, table],
      });

      stack.addOutputs({
        SiteUrl: site.url,
      });
    });

    //enable OTel traces
    Tags.of(app).add("baselime:tracing", `true`);
  },
} satisfies SSTConfig;
