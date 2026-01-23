/**
 * Graph Indexer - Service relationship indexing
 */

import logger from '../../lib/logger.js';
import { supabase } from '../../lib/supabase.js';

export interface ServiceNode {
    id: string;
    name: string;
    type: string;
    owner: string;
}

export interface ServiceEdge {
    from: string;
    to: string;
    weight: number;
}

export interface ServiceGraph {
    nodes: ServiceNode[];
    edges: ServiceEdge[];
}

export const graphIndexer = {
    async getServiceGraph(): Promise<ServiceGraph> {
        logger.info('Fetching service graph');

        // Get all services
        const { data: services, error: servicesError } = await supabase
            .from('services')
            .select('id, name, category, owner_address')
            .eq('is_active', true);

        if (servicesError) {
            logger.error('Failed to fetch services', servicesError);
            return { nodes: [], edges: [] };
        }

        // Build nodes
        const nodes: ServiceNode[] = services.map(s => ({
            id: s.id,
            name: s.name,
            type: s.category || 'unknown',
            owner: s.owner_address,
        }));

        // Get service relationships from service_graph table
        const { data: relationships, error: relError } = await supabase
            .from('service_graph')
            .select('from_service_id, to_service_id, call_count');

        if (relError) {
            logger.warn('No service_graph table or error fetching relationships', relError);
            return { nodes, edges: [] };
        }

        // Build edges with weight based on call count
        const edges: ServiceEdge[] = relationships.map(r => ({
            from: r.from_service_id,
            to: r.to_service_id,
            weight: r.call_count || 1,
        }));

        return { nodes, edges };
    },

    async getServiceDependencies(serviceId: string): Promise<string[]> {
        logger.info('Fetching service dependencies', { serviceId });

        const { data, error } = await supabase
            .from('service_graph')
            .select('to_service_id')
            .eq('from_service_id', serviceId);

        if (error) {
            logger.warn('Failed to fetch dependencies', error);
            return [];
        }

        return data.map(d => d.to_service_id);
    },

    async getServiceDependents(serviceId: string): Promise<string[]> {
        logger.info('Fetching service dependents', { serviceId });

        const { data, error } = await supabase
            .from('service_graph')
            .select('from_service_id')
            .eq('to_service_id', serviceId);

        if (error) {
            logger.warn('Failed to fetch dependents', error);
            return [];
        }

        return data.map(d => d.from_service_id);
    },

    async findServicePath(from: string, to: string, maxDepth: number): Promise<string[][]> {
        logger.info('Finding service path', { from, to, maxDepth });

        // BFS to find all paths
        const paths: string[][] = [];
        const queue: { path: string[]; visited: Set<string> }[] = [
            { path: [from], visited: new Set([from]) }
        ];

        while (queue.length > 0) {
            const { path, visited } = queue.shift()!;
            const current = path[path.length - 1];

            if (current === to) {
                paths.push(path);
                continue;
            }

            if (path.length >= maxDepth) continue;

            const deps = await this.getServiceDependencies(current);
            for (const dep of deps) {
                if (!visited.has(dep)) {
                    const newVisited = new Set(visited);
                    newVisited.add(dep);
                    queue.push({
                        path: [...path, dep],
                        visited: newVisited,
                    });
                }
            }
        }

        return paths;
    },

    async getAllRelationships(): Promise<ServiceGraph> {
        return this.getServiceGraph();
    },

    async suggestWorkflows(startInputType: string, endOutputType: string, maxSteps: number): Promise<unknown[]> {
        logger.info('Suggesting workflows', { startInputType, endOutputType, maxSteps });

        // Find services that accept startInputType
        const { data: startServices } = await supabase
            .from('service_schemas')
            .select('service_id')
            .contains('input_schema', { type: startInputType });

        // Find services that produce endOutputType
        const { data: endServices } = await supabase
            .from('service_schemas')
            .select('service_id')
            .contains('output_schema', { type: endOutputType });

        if (!startServices || !endServices) return [];

        // Find paths between start and end services
        const workflows: unknown[] = [];
        for (const start of startServices) {
            for (const end of endServices) {
                const paths = await this.findServicePath(start.service_id, end.service_id, maxSteps);
                workflows.push(...paths.map(path => ({ path, steps: path.length })));
            }
        }

        return workflows;
    },

    async indexServiceRelationships(): Promise<void> {
        logger.info('Indexing service relationships');

        // This would be called periodically to update the service_graph table
        // based on actual service calls tracked in agent_activity or outcomes

        const { data: activities } = await supabase
            .from('agent_activity')
            .select('metadata')
            .eq('activity_type', 'service_called')
            .gte('timestamp', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (!activities) return;

        // Count service-to-service calls
        const callCounts = new Map<string, number>();

        for (const activity of activities) {
            const meta = activity.metadata as any;
            if (meta?.from_service && meta?.to_service) {
                const key = `${meta.from_service}:${meta.to_service}`;
                callCounts.set(key, (callCounts.get(key) || 0) + 1);
            }
        }

        // Upsert into service_graph
        for (const [key, count] of callCounts.entries()) {
            const [from, to] = key.split(':');
            await supabase
                .from('service_graph')
                .upsert({
                    from_service_id: from,
                    to_service_id: to,
                    call_count: count,
                    last_called_at: new Date().toISOString(),
                }, { onConflict: 'from_service_id,to_service_id' });
        }

        logger.info('Service relationships indexed', { relationshipCount: callCounts.size });
    }
};

export default graphIndexer;
