/**
 * NexusPulse Enterprise GraphQL Schema & Resolvers
 *
 * Defines strongly-typed schemas for time-series telemetry streams,
 * cluster health monitoring, RBAC authorization, and LTTB downsampling.
 *
 * Designed and engineered by Mohamed Seddik Feki.
 */

import { TimeSeriesEngine, lttbDownsample } from '../lib/timeseries-engine.ts';
import type { DataPoint, MetricSummary } from '../lib/timeseries-engine.ts';
import {
  ROLE_PERMISSIONS,
  hasPermission,
  authService
} from '../lib/rbac-jwt.ts';
import type { Role, Permission, TokenPair } from '../lib/rbac-jwt.ts';

// ============================================================================
// 1. GraphQL Type Definitions (SDL)
// ============================================================================

export const typeDefs = /* GraphQL */ `
  enum Role {
    ADMIN
    ENGINEER
    VIEWER
  }

  type MetricPoint {
    timestamp: Float!
    value: Float!
    secondary: Float
  }

  type TelemetrySummary {
    metricName: String!
    totalPoints: Int!
    min: Float!
    max: Float!
    avg: Float!
    p95: Float!
    p99: Float!
    stdDev: Float!
    latestValue: Float!
  }

  type TelemetrySeries {
    metricName: String!
    originalCount: Int!
    sampledCount: Int!
    compressionRatio: Float!
    durationMs: Float!
    points: [MetricPoint!]!
    summary: TelemetrySummary!
  }

  type ClusterNode {
    id: ID!
    name: String!
    region: String!
    status: String!
    cpuUsagePercent: Float!
    memoryUsagePercent: Float!
    requestsPerSec: Float!
    lastHeartbeatMs: Float!
  }

  type UserProfile {
    id: ID!
    email: String!
    name: String!
    role: Role!
    permissions: [String!]!
  }

  type AuthPayload {
    accessToken: String!
    refreshToken: String!
    expiresInSeconds: Int!
    tokenType: String!
    user: UserProfile!
  }

  type Query {
    getTelemetry(
      metric: String!
      pointCount: Int
      targetResolution: Int
    ): TelemetrySeries!

    getClusterHealth: [ClusterNode!]!

    me: UserProfile!

    availableMetrics: [String!]!
  }

  type Mutation {
    switchRole(role: Role!): AuthPayload!

    rotateTokens(refreshToken: String!): AuthPayload!

    restartNode(nodeId: ID!): ClusterNode!

    triggerLttbDownsample(
      pointCount: Int!
      targetResolution: Int!
    ): TelemetrySeries!
  }
`;

// ============================================================================
// 2. Mock Cluster Infrastructure State
// ============================================================================

interface ClusterNodeState {
  id: string;
  name: string;
  region: string;
  status: 'ONLINE' | 'DEGRADED' | 'REBOOTING';
  cpuUsagePercent: number;
  memoryUsagePercent: number;
  requestsPerSec: number;
  lastHeartbeatMs: number;
}

const clusterNodes: ClusterNodeState[] = [
  {
    id: 'nexus-edge-ap-southeast',
    name: 'Nexus-AP-Southeast (Singapore)',
    region: 'ap-southeast-1',
    status: 'ONLINE',
    cpuUsagePercent: 38.4,
    memoryUsagePercent: 61.2,
    requestsPerSec: 18450.0,
    lastHeartbeatMs: 45
  },
  {
    id: 'nexus-core-eu-central',
    name: 'Nexus-EU-Central (Frankfurt)',
    region: 'eu-central-1',
    status: 'ONLINE',
    cpuUsagePercent: 44.8,
    memoryUsagePercent: 68.5,
    requestsPerSec: 21320.0,
    lastHeartbeatMs: 32
  },
  {
    id: 'nexus-primary-us-east',
    name: 'Nexus-US-East (N. Virginia)',
    region: 'us-east-1',
    status: 'ONLINE',
    cpuUsagePercent: 52.1,
    memoryUsagePercent: 74.0,
    requestsPerSec: 28940.0,
    lastHeartbeatMs: 28
  }
];

// Persistent engine instance populated with 50,000 synthetic metrics
const defaultEngine = new TimeSeriesEngine('api_throughput_rps', 100000);
defaultEngine.generateSyntheticDataset(50000, 1000, 1420.0);

// Default mock current user
let currentUser = {
  id: 'usr-admin-01',
  email: 'seddikfeki15@gmail.com',
  name: 'Mohamed Seddik Feki',
  role: 'ADMIN' as Role
};

let currentSession = authService.createSession(currentUser);

// ============================================================================
// 3. Resolvers Implementation
// ============================================================================

export interface GraphQLContext {
  userRole?: Role;
  userId?: string;
}

export const resolvers = {
  Query: {
    getTelemetry: (
      _: unknown,
      args: { metric: string; pointCount?: number; targetResolution?: number }
    ) => {
      const pointCount = args.pointCount || 50000;
      const targetResolution = args.targetResolution || 1000;

      // Re-generate if point count differs from current buffer
      if (defaultEngine.length !== pointCount) {
        defaultEngine.generateSyntheticDataset(pointCount, 1000, 1420.0);
      }

      const downsampleResult = defaultEngine.getDownsampled(targetResolution);
      const summary = defaultEngine.computeSummary();

      return {
        metricName: args.metric || 'api_throughput_rps',
        originalCount: downsampleResult.originalCount,
        sampledCount: downsampleResult.sampledCount,
        compressionRatio: downsampleResult.compressionRatio,
        durationMs: downsampleResult.durationMs,
        points: downsampleResult.sampled,
        summary
      };
    },

    getClusterHealth: () => {
      return clusterNodes;
    },

    me: (_: unknown, __: unknown, context?: GraphQLContext) => {
      const activeRole = context?.userRole || currentUser.role;
      return {
        id: currentUser.id,
        email: currentUser.email,
        name: currentUser.name,
        role: activeRole,
        permissions: [...ROLE_PERMISSIONS[activeRole]]
      };
    },

    availableMetrics: () => {
      return [
        'api_throughput_rps',
        'p99_latency_ms',
        'cpu_utilization_pct',
        'db_connection_pool',
        'lttb_frame_budget_ms'
      ];
    }
  },

  Mutation: {
    switchRole: (_: unknown, args: { role: Role }) => {
      const allowedRoles: Role[] = ['ADMIN', 'ENGINEER', 'VIEWER'];
      if (!allowedRoles.includes(args.role)) {
        throw new Error(
          `Invalid role "${args.role}". Allowed roles: ${allowedRoles.join(', ')}.`
        );
      }
      currentUser.role = args.role;
      currentSession = authService.createSession(currentUser);
      return currentSession;
    },

    rotateTokens: (_: unknown, args: { refreshToken: string }) => {
      currentSession = authService.rotateTokens(args.refreshToken, currentUser);
      return currentSession;
    },

    restartNode: (
      _: unknown,
      args: { nodeId: string },
      context?: GraphQLContext
    ) => {
      const activeRole = context?.userRole || currentUser.role;

      // Granular RBAC Check: Only ENGINEER and ADMIN can restart nodes
      if (!hasPermission(activeRole, 'nodes:restart_service')) {
        throw new Error(
          `Permission Denied: Role "${activeRole}" does not have "nodes:restart_service" permission.`
        );
      }

      const node = clusterNodes.find(n => n.id === args.nodeId);
      if (!node) {
        throw new Error(`Cluster node with ID "${args.nodeId}" not found.`);
      }

      node.status = 'ONLINE';
      node.lastHeartbeatMs = 12;
      return node;
    },

    triggerLttbDownsample: (
      _: unknown,
      args: { pointCount: number; targetResolution: number }
    ) => {
      const engine = new TimeSeriesEngine('custom_downsample_benchmark', args.pointCount);
      engine.generateSyntheticDataset(args.pointCount, 1000, 1500.0);
      const res = engine.getDownsampled(args.targetResolution);
      const summary = engine.computeSummary();

      return {
        metricName: 'custom_downsample_benchmark',
        originalCount: res.originalCount,
        sampledCount: res.sampledCount,
        compressionRatio: res.compressionRatio,
        durationMs: res.durationMs,
        points: res.sampled,
        summary
      };
    }
  }
};

// ============================================================================
// 4. In-Process Lightweight GraphQL Executor
// ============================================================================

/**
 * Executes a GraphQL query against the in-memory schema and resolvers.
 * Provides zero-dependency, instant GraphQL execution for Next.js SSR and demo UI.
 */
export async function executeGraphQLQuery(
  query: string,
  variables: Record<string, unknown> = {},
  context: GraphQLContext = { userRole: currentUser.role }
): Promise<{ data?: any; errors?: Array<{ message: string }> }> {
  try {
    const trimmed = query.trim();
    const data: Record<string, any> = {};
    let executedAny = false;

    // Route: getTelemetry query
    if (trimmed.includes('getTelemetry')) {
      executedAny = true;
      let pointCount = (variables.pointCount as number);
      let targetResolution = (variables.targetResolution as number);
      let metric = (variables.metric as string);

      if (!pointCount) {
        const match = trimmed.match(/pointCount\s*:\s*(\d+)/);
        if (match) pointCount = parseInt(match[1], 10);
      }
      if (!targetResolution) {
        const match = trimmed.match(/targetResolution\s*:\s*(\d+)/);
        if (match) targetResolution = parseInt(match[1], 10);
      }
      if (!metric) {
        const match = trimmed.match(/metric\s*:\s*["']([^"']+)["']/);
        if (match) metric = match[1];
      }

      pointCount = pointCount || 50000;
      targetResolution = targetResolution || 1000;
      metric = metric || 'api_throughput_rps';

      data.getTelemetry = resolvers.Query.getTelemetry(null, {
        metric,
        pointCount,
        targetResolution
      });
    }

    // Route: getClusterHealth query
    if (trimmed.includes('getClusterHealth')) {
      executedAny = true;
      data.getClusterHealth = resolvers.Query.getClusterHealth();
    }

    // Route: me query
    if (trimmed.includes('me')) {
      executedAny = true;
      data.me = resolvers.Query.me(null, null, context);
    }

    // Route: availableMetrics query
    if (trimmed.includes('availableMetrics')) {
      executedAny = true;
      data.availableMetrics = resolvers.Query.availableMetrics();
    }

    // Route: switchRole mutation
    if (trimmed.includes('switchRole')) {
      executedAny = true;
      let role = (variables.role as Role);
      if (!role) {
        const match = trimmed.match(/role\s*:\s*["']?([A-Za-z0-9_]+)["']?/);
        if (match) role = match[1] as Role;
      }
      if (!role) {
        throw new Error('Missing required argument: "role".');
      }
      data.switchRole = resolvers.Mutation.switchRole(null, { role });
    }

    // Route: restartNode mutation
    if (trimmed.includes('restartNode')) {
      executedAny = true;
      let nodeId = (variables.nodeId as string);
      if (!nodeId) {
        const match = trimmed.match(/nodeId\s*:\s*["']([^"']+)["']/);
        if (match) nodeId = match[1];
      }
      nodeId = nodeId || 'nexus-edge-ap-southeast';
      data.restartNode = resolvers.Mutation.restartNode(null, { nodeId }, context);
    }

    // Route: triggerLttbDownsample mutation
    if (trimmed.includes('triggerLttbDownsample')) {
      executedAny = true;
      let pointCount = (variables.pointCount as number);
      let targetResolution = (variables.targetResolution as number);
      if (!pointCount) {
        const match = trimmed.match(/pointCount\s*:\s*(\d+)/);
        if (match) pointCount = parseInt(match[1], 10);
      }
      if (!targetResolution) {
        const match = trimmed.match(/targetResolution\s*:\s*(\d+)/);
        if (match) targetResolution = parseInt(match[1], 10);
      }
      pointCount = pointCount || 50000;
      targetResolution = targetResolution || 1000;
      data.triggerLttbDownsample = resolvers.Mutation.triggerLttbDownsample(null, {
        pointCount,
        targetResolution
      });
    }

    // Route: rotateTokens mutation
    if (trimmed.includes('rotateTokens')) {
      executedAny = true;
      let refreshToken = (variables.refreshToken as string);
      if (!refreshToken) {
        const match = trimmed.match(/refreshToken\s*:\s*["']([^"']+)["']/);
        if (match) refreshToken = match[1];
      }
      refreshToken = refreshToken || currentSession.refreshToken;
      data.rotateTokens = resolvers.Mutation.rotateTokens(null, { refreshToken });
    }

    if (!executedAny) {
      return {
        errors: [
          { message: `Unknown GraphQL operation. Supported queries: getTelemetry, getClusterHealth, me, availableMetrics, switchRole, restartNode, triggerLttbDownsample, rotateTokens.` }
        ]
      };
    }

    return { data };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { errors: [{ message }] };
  }
}
