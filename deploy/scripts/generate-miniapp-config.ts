#!/usr/bin/env node
/**
 * MiniApp Configuration Generator
 *
 * This script generates MiniApp configuration files from templates.
 *
 * Usage:
 *   node scripts/generate-miniapp-config.ts --type prediction --id my-prediction-market
 *   node scripts/generate-miniapp-config.ts --from-contract ./contracts/build/MyContract.nef
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const TEMPLATES = {
  prediction: {
    name: 'Prediction Market',
    template_type: 'prediction',
    frontend_spec: {
      layout: 'prediction',
      hero: {
        eyebrow: 'Prediction Market',
        disclaimer: 'Prices imply probabilities, not guarantees.'
      },
      tabs: [
        { id: 'market-info', label: 'Market Info', type: 'content', blocks: [] },
        { id: 'reviews', label: 'Reviews', type: 'reviews' },
        { id: 'forum', label: 'Discussion', type: 'forum' },
        { id: 'news', label: 'Activity', type: 'news' }
      ],
      operation_panel: {
        title: 'Trade Position',
        subtitle: 'Select your position and stake amount.',
        operations: [
          {
            name: 'Buy YES',
            method: 'buyYes',
            button_style: 'primary',
            params: [
              { name: 'amount', type: 'amount', label: 'Stake Amount (GAS)', required: true }
            ]
          },
          {
            name: 'Buy NO',
            method: 'buyNo',
            button_style: 'secondary',
            params: [
              { name: 'amount', type: 'amount', label: 'Stake Amount (GAS)', required: true }
            ]
          }
        ]
      }
    },
    permissions: { payments: true, datafeed: true, oracle: true }
  },

  voting: {
    name: 'Voting',
    template_type: 'voting',
    frontend_spec: {
      layout: 'default',
      hero: {
        eyebrow: 'Governance Vote',
        disclaimer: 'Your voting power is based on your token holdings.'
      },
      tabs: [
        { id: 'proposal', label: 'Proposal', type: 'content', blocks: [] },
        { id: 'discussion', label: 'Discussion', type: 'forum' },
        { id: 'reviews', label: 'Feedback', type: 'reviews' }
      ],
      operation_panel: {
        title: 'Cast Your Vote',
        operations: [
          {
            name: 'Vote',
            method: 'vote',
            button_style: 'primary',
            params: [
              {
                name: 'support',
                type: 'select',
                required: true,
                options: [
                  { label: 'For', value: 'for' },
                  { label: 'Against', value: 'against' },
                  { label: 'Abstain', value: 'abstain' }
                ]
              }
            ]
          }
        ]
      }
    },
    permissions: { governance: true, storage: true }
  },

  lottery: {
    name: 'Lottery',
    template_type: 'lottery',
    frontend_spec: {
      layout: 'default',
      hero: {
        eyebrow: 'Lottery',
        disclaimer: 'Gambling can be addictive. Play responsibly.'
      },
      tabs: [
        { id: 'how-to-play', label: 'How to Play', type: 'content', blocks: [] },
        { id: 'past-draws', label: 'Past Draws', type: 'content', blocks: [] },
        { id: 'reviews', label: 'Reviews', type: 'reviews' }
      ],
      operation_panel: {
        title: 'Buy Tickets',
        operations: [
          {
            name: 'Buy Tickets',
            method: 'buyTickets',
            button_style: 'primary',
            params: [
              { name: 'count', type: 'integer', label: 'Number of Tickets', required: true, default_value: '1' }
            ]
          }
        ]
      }
    },
    permissions: { payments: true, randomness: true }
  },

  auction: {
    name: 'Auction',
    template_type: 'auction',
    frontend_spec: {
      layout: 'default',
      hero: {
        eyebrow: 'Auction'
      },
      tabs: [
        { id: 'details', label: 'Details', type: 'content', blocks: [] },
        { id: 'bids', label: 'Bid History', type: 'content', blocks: [] },
        { id: 'reviews', label: 'Reviews', type: 'reviews' }
      ],
      operation_panel: {
        title: 'Place Bid',
        operations: [
          {
            name: 'Bid',
            method: 'bid',
            button_style: 'primary',
            params: [
              { name: 'amount', type: 'amount', label: 'Bid Amount (GAS)', required: true }
            ]
          }
        ]
      }
    },
    permissions: { payments: true }
  },

  tipping: {
    name: 'Tipping',
    template_type: 'tipping',
    frontend_spec: {
      layout: 'default',
      hero: {
        eyebrow: 'Tipping',
        disclaimer: 'All tips are final and non-refundable.'
      },
      tabs: [
        { id: 'about', label: 'About', type: 'content', blocks: [] },
        { id: 'leaderboard', label: 'Leaderboard', type: 'content', blocks: [] },
        { id: 'reviews', label: 'Reviews', type: 'reviews' }
      ],
      operation_panel: {
        title: 'Send a Tip',
        operations: [
          {
            name: 'Tip',
            method: 'tip',
            button_style: 'primary',
            params: [
              { name: 'recipient', type: 'address', label: 'Recipient Address', required: true },
              { name: 'amount', type: 'amount', label: 'Tip Amount (GAS)', required: true }
            ]
          }
        ]
      }
    },
    permissions: { payments: true }
  },

  governance: {
    name: 'Governance',
    template_type: 'governance',
    frontend_spec: {
      layout: 'default',
      hero: {
        eyebrow: 'Governance'
      },
      tabs: [
        { id: 'overview', label: 'Overview', type: 'content', blocks: [] },
        { id: 'proposals', label: 'Proposals', type: 'content', blocks: [] },
        { id: 'delegates', label: 'Delegates', type: 'content', blocks: [] }
      ],
      operation_panel: {
        title: 'Actions',
        operations: [
          {
            name: 'Delegate',
            method: 'delegate',
            button_style: 'primary',
            params: [
              { name: 'delegatee', type: 'address', label: 'Delegate To', required: true }
            ]
          }
        ]
      }
    },
    permissions: { governance: true }
  },

  defi: {
    name: 'DeFi',
    template_type: 'defi',
    frontend_spec: {
      layout: 'default',
      hero: {
        eyebrow: 'DeFi Protocol'
      },
      tabs: [
        { id: 'overview', label: 'Overview', type: 'content', blocks: [] },
        { id: 'pools', label: 'Pools', type: 'content', blocks: [] },
        { id: 'analytics', label: 'Analytics', type: 'content', blocks: [] }
      ],
      operation_panel: {
        title: 'Actions',
        operations: [
          {
            name: 'Deposit',
            method: 'deposit',
            button_style: 'primary',
            params: [
              { name: 'amount', type: 'amount', label: 'Amount (GAS)', required: true }
            ]
          },
          {
            name: 'Withdraw',
            method: 'withdraw',
            button_style: 'secondary',
            params: [
              { name: 'amount', type: 'amount', label: 'Amount (GAS)', required: true }
            ]
          }
        ]
      }
    },
    permissions: { payments: true, datafeed: true }
  },

  nft: {
    name: 'NFT',
    template_type: 'nft',
    frontend_spec: {
      layout: 'default',
      hero: {
        eyebrow: 'NFT Collection'
      },
      tabs: [
        { id: 'collection', label: 'Collection', type: 'content', blocks: [] },
        { id: 'activity', label: 'Activity', type: 'news' },
        { id: 'reviews', label: 'Reviews', type: 'reviews' }
      ],
      operation_panel: {
        title: 'Actions',
        operations: [
          {
            name: 'Mint',
            method: 'mint',
            button_style: 'primary',
            params: [
              { name: 'quantity', type: 'integer', label: 'Quantity', required: true, default_value: '1' }
            ]
          }
        ]
      }
    },
    permissions: { payments: true, storage: true }
  },

  default: {
    name: 'Default',
    template_type: 'default',
    frontend_spec: {
      layout: 'default',
      tabs: [
        { id: 'overview', label: 'Overview', type: 'content', blocks: [] },
        { id: 'reviews', label: 'Reviews', type: 'reviews' },
        { id: 'forum', label: 'Discussion', type: 'forum' }
      ],
      operation_panel: {
        title: 'Operations',
        operations: []
      }
    },
    permissions: {}
  }
};

function generateId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 64);
}

function generateConfig(type: string, options: Record<string, any>): Record<string, any> {
  const template = TEMPLATES[type] || TEMPLATES.default;
  const id = options.id || generateId(options.name || `new-${type}`);

  return {
    '$schema': './miniapp-config.schema.json',
    app_id: id,
    name: options.name || `${template.name} App`,
    description: options.description || `A ${template.name.toLowerCase()} application on Neo.`,
    template_type: template.template_type,
    category: options.category || template.name,
    tags: options.tags || [],
    version: '1.0.0',
    status: 'draft',
    developer: options.developer || {},
    contract: options.contract || {
      template_id: `${type}-template`,
      init_params: {}
    },
    entry_url: options.entry_url || '',
    media: options.media || {},
    permissions: { ...template.permissions, ...(options.permissions || {}) },
    limits: options.limits || {},
    frontend_spec: template.frontend_spec,
    integration: {
      news_integration: true,
      reviews_enabled: true,
      forum_enabled: true,
      activity_feed: true,
      stats_display: ['total_transactions', 'daily_active_users', 'total_gas_used']
    },
    docs_url: options.docs_url || ''
  };
}

function main() {
  const args = process.argv.slice(2);
  const options: Record<string, any> = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value = args[i + 1];
      if (value && !value.startsWith('--')) {
        options[key] = value;
        i++;
      } else {
        options[key] = true;
      }
    }
  }

  const type = options.type || 'default';
  const outputDir = options.output || 'platform/host-app/public/miniapp-definitions';
  const outputFile = options.outputFile || `${options.id || `new-${type}`}.json`;

  if (options.list) {
    console.log('Available template types:');
    Object.keys(TEMPLATES).forEach(t => console.log(`  - ${t}`));
    process.exit(0);
  }

  if (!options.id) {
    console.error('Error: --id is required');
    console.error('Usage: node generate-miniapp-config.ts --type <type> --id <app-id> [--name <name>]');
    process.exit(1);
  }

  const config = generateConfig(type, options);
  const outputPath = path.join(outputDir, outputFile);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(config, null, 2));

  console.log(`✅ Generated configuration: ${outputPath}`);
  console.log(`   App ID: ${config.app_id}`);
  console.log(`   Template: ${config.template_type}`);
}

main();
