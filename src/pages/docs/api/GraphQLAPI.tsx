export default function DocsGraphQLAPI() {
    return (
        <div className="space-y-8">
            <div>
                <h1 className="text-4xl font-bold text-gray-900 mb-4">GraphQL API Reference</h1>
                <p className="text-lg text-gray-600">
                    Query trading data, venues, and reputation using GraphQL.
                </p>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Endpoint</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <code className="text-sm text-gray-800">http://localhost:4000/graphql</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Schema</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`type Query {
  venues: [Venue!]!
  venue(id: ID!): Venue
  trades(limit: Int, offset: Int): [Trade!]!
  trade(id: ID!): Trade
  agents: [Agent!]!
  agent(id: ID!): Agent
  services: [Service!]!
  service(id: ID!): Service
}

type Venue {
  id: ID!
  name: String!
  type: String!
  reputation: VenueReputation!
  totalTrades: Int!
  successRate: Float!
}

type VenueReputation {
  score: Float!
  totalTrades: Int!
  successRate: Float!
  avgLatency: Float!
  avgSlippage: Float!
}

type Trade {
  id: ID!
  pair: String!
  side: String!
  leverage: Int!
  sizeUsd: Float!
  entryPrice: Float!
  exitPrice: Float
  pnl: Float
  status: String!
  venue: Venue!
  createdAt: String!
}

type Agent {
  id: ID!
  name: String!
  endpoint: String!
  owner: String!
  reputation: AgentReputation!
  registeredAt: String!
}

type AgentReputation {
  totalTrades: Int!
  averageScore: Float!
  successRate: Float!
  lastUpdated: String!
}

type Service {
  id: ID!
  name: String!
  category: String!
  endpoint: String!
  pricePerCall: Float!
  provider: String!
  reputation: Float!
  healthStatus: HealthStatus
}

type HealthStatus {
  status: String!
  lastCheck: String!
  uptime: Float!
}`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Example Queries</h2>

                <div className="space-y-4">
                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">Get All Venues</h3>
                        <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-x-auto">
                            <code className="text-gray-800">{`query {
  venues {
    id
    name
    type
    reputation {
      score
      totalTrades
      successRate
      avgLatency
      avgSlippage
    }
  }
}`}</code>
                        </pre>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">Get Recent Trades</h3>
                        <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-x-auto">
                            <code className="text-gray-800">{`query {
  trades(limit: 10) {
    id
    pair
    side
    leverage
    sizeUsd
    entryPrice
    exitPrice
    pnl
    status
    venue {
      name
    }
    createdAt
  }
}`}</code>
                        </pre>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">Get Agent Reputation</h3>
                        <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-x-auto">
                            <code className="text-gray-800">{`query {
  agent(id: "1") {
    id
    name
    endpoint
    owner
    reputation {
      totalTrades
      averageScore
      successRate
      lastUpdated
    }
  }
}`}</code>
                        </pre>
                    </div>

                    <div className="border border-gray-200 rounded-lg p-4">
                        <h3 className="font-semibold text-gray-900 mb-3">Get Services by Category</h3>
                        <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs overflow-x-auto">
                            <code className="text-gray-800">{`query {
  services {
    id
    name
    category
    endpoint
    pricePerCall
    provider
    reputation
    healthStatus {
      status
      lastCheck
      uptime
    }
  }
}`}</code>
                        </pre>
                    </div>
                </div>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Using with JavaScript</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`async function fetchVenues() {
  const query = \`
    query {
      venues {
        id
        name
        reputation {
          score
          successRate
        }
      }
    }
  \`;

  const response = await fetch('http://localhost:4000/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query })
  });

  const { data } = await response.json();
  return data.venues;
}`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Using Apollo Client</h2>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`import { ApolloClient, InMemoryCache, gql } from '@apollo/client';

const client = new ApolloClient({
  uri: 'http://localhost:4000/graphql',
  cache: new InMemoryCache()
});

const GET_VENUES = gql\`
  query GetVenues {
    venues {
      id
      name
      reputation {
        score
        successRate
      }
    }
  }
\`;

const { data } = await client.query({
  query: GET_VENUES
});`}</code>
                </pre>
            </div>

            <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Subscriptions</h2>
                <p className="text-gray-700">Real-time updates for trades and venue changes:</p>
                <pre className="bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto">
                    <code className="text-sm text-gray-800">{`subscription {
  tradeCreated {
    id
    pair
    side
    sizeUsd
    venue {
      name
    }
  }
}

subscription {
  venueReputationUpdated {
    id
    name
    reputation {
      score
      successRate
    }
  }
}`}</code>
                </pre>
            </div>
        </div>
    );
}
