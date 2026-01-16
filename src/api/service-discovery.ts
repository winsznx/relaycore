import { Router } from 'express';
import { supabase } from '../lib/supabase';
import { graphIndexer } from '../services/indexer/graph-indexer';
import { temporalIndexer } from '../services/indexer/temporal-indexer';
import logger from '../lib/logger';

const router = Router();

// Type for formatted service output
interface FormattedService {
    id: string;
    name: string;
    description: string;
    category: string;
    endpointUrl: string;
    pricePerCall: string;
    ownerAddress: string;
    isActive: boolean;
    createdAt: string;
    lastActive: string;
    reputationScore: number;
    totalPayments: number;
    successfulPayments: number;
    failedPayments: number;
    avgLatencyMs: number;
    uniquePayers: number;
    successRate: number;
    schema: {
        inputType: string;
        outputType: string;
        tags: string[];
        capabilities: string[];
        inputSchema: Record<string, unknown>;
        outputSchema: Record<string, unknown>;
        version: string;
    } | null;
}

/**
 * Service Discovery API
 * 
 * REST endpoints for discovering and querying services
 * with support for type-safe filtering and composite metrics.
 */

// ============================================
// SERVICE DISCOVERY ENDPOINTS
// ============================================

/**
 * GET /api/services
 * 
 * Discover services with advanced filtering.
 * Supports filtering by category, reputation, latency, input/output types.
 */
router.get('/', async (req, res) => {
    try {
        const {
            category,
            minReputation = 0,
            maxLatency,
            inputType,
            outputType,
            tags,
            capabilities,
            sortBy = 'reputation',
            limit = 20,
            offset = 0
        } = req.query;

        // Build base query
        let query = supabase
            .from('services')
            .select(`
        *,
        reputations (
          total_payments,
          successful_payments,
          failed_payments,
          avg_latency_ms,
          unique_payers,
          reputation_score
        ),
        service_schemas (
          input_schema,
          output_schema,
          input_type,
          output_type,
          tags,
          capabilities
        )
      `)
            .eq('is_active', true);

        // Apply filters
        if (category) {
            query = query.eq('category', category);
        }

        // Execute query
        const { data: services, error } = await query
            .range(Number(offset), Number(offset) + Number(limit) - 1);

        if (error) {
            logger.error('Service discovery failed', error);
            return res.status(500).json({ error: 'Failed to fetch services' });
        }

        // Post-process filters and sorting
        let results = services.map(formatServiceForDiscovery);

        // Filter by reputation
        if (minReputation) {
            results = results.filter(s => s.reputationScore >= Number(minReputation));
        }

        // Filter by latency
        if (maxLatency) {
            results = results.filter(s => s.avgLatencyMs <= Number(maxLatency));
        }

        // Filter by input/output type
        if (inputType) {
            results = results.filter(s => s.schema?.inputType === inputType);
        }
        if (outputType) {
            results = results.filter(s => s.schema?.outputType === outputType);
        }

        // Filter by tags
        if (tags) {
            const tagList = String(tags).split(',');
            results = results.filter(s =>
                tagList.some(tag => s.schema?.tags?.includes(tag))
            );
        }

        // Filter by capabilities
        if (capabilities) {
            const capList = String(capabilities).split(',');
            results = results.filter(s =>
                capList.some(cap => s.schema?.capabilities?.includes(cap))
            );
        }

        // Sort results
        results.sort((a, b) => {
            switch (sortBy) {
                case 'reputation':
                    return b.reputationScore - a.reputationScore;
                case 'latency':
                    return a.avgLatencyMs - b.avgLatencyMs;
                case 'price':
                    return Number(a.pricePerCall) - Number(b.pricePerCall);
                case 'volume':
                    return b.totalPayments - a.totalPayments;
                default:
                    return b.reputationScore - a.reputationScore;
            }
        });

        res.json({
            services: results,
            total: results.length,
            offset: Number(offset),
            limit: Number(limit)
        });
    } catch (error) {
        logger.error('Service discovery error', error as Error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * GET /api/services/:id
 * 
 * Get detailed service information including schema and metrics.
 */
router.get('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase
            .from('services')
            .select(`
        *,
        reputations (
          total_payments,
          successful_payments,
          failed_payments,
          avg_latency_ms,
          unique_payers,
          reputation_score
        ),
        service_schemas (
          input_schema,
          output_schema,
          input_type,
          output_type,
          tags,
          capabilities,
          schema_version
        )
      `)
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Service not found' });
            }
            throw error;
        }

        // Get temporal trend
        const trend = await temporalIndexer.getServiceTrend(id);

        // Get dependencies and dependents
        const [dependencies, dependents] = await Promise.all([
            graphIndexer.getServiceDependencies(id),
            graphIndexer.getServiceDependents(id)
        ]);

        res.json({
            ...formatServiceForDiscovery(data),
            trend,
            dependencies: dependencies.slice(0, 10),
            dependents: dependents.slice(0, 10)
        });
    } catch (error) {
        logger.error('Service detail error', error as Error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

/**
 * POST /api/services
 * 
 * Register a new service.
 * Requires wallet signature for authentication.
 */
router.post('/', async (req, res) => {
    try {
        const {
            name,
            description,
            category,
            endpointUrl,
            pricePerCall,
            ownerAddress,
            inputSchema,
            outputSchema,
            inputType,
            outputType,
            tags,
            capabilities
        } = req.body;

        // Validate required fields
        if (!name || !ownerAddress || !endpointUrl) {
            return res.status(400).json({
                error: 'Missing required fields: name, ownerAddress, endpointUrl'
            });
        }

        // Insert service
        const { data: service, error: serviceError } = await supabase
            .from('services')
            .insert({
                name,
                description,
                category,
                endpoint_url: endpointUrl,
                price_per_call: pricePerCall || '0',
                owner_address: ownerAddress.toLowerCase(),
                is_active: true
            })
            .select()
            .single();

        if (serviceError) {
            throw serviceError;
        }

        // Insert schema if provided
        if (inputSchema || outputSchema || inputType || outputType) {
            const { error: schemaError } = await supabase
                .from('service_schemas')
                .insert({
                    service_id: service.id,
                    input_schema: inputSchema || {},
                    output_schema: outputSchema || {},
                    input_type: inputType,
                    output_type: outputType,
                    tags: tags || [],
                    capabilities: capabilities || []
                });

            if (schemaError) {
                logger.error('Schema insert failed', schemaError);
            }
        }

        // Initialize reputation
        await supabase.from('reputations').insert({
            service_id: service.id,
            total_payments: 0,
            successful_payments: 0,
            failed_payments: 0,
            reputation_score: 50 // Starting reputation
        });

        res.status(201).json({
            id: service.id,
            name: service.name,
            endpointUrl: service.endpoint_url,
            message: 'Service registered successfully'
        });
    } catch (error) {
        logger.error('Service registration error', error as Error);
        res.status(500).json({ error: 'Failed to register service' });
    }
});

/**
 * PUT /api/services/:id
 * 
 * Update service details.
 */
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;

        // Map camelCase to snake_case
        const dbUpdates: Record<string, unknown> = {};
        if (updates.name) dbUpdates.name = updates.name;
        if (updates.description) dbUpdates.description = updates.description;
        if (updates.category) dbUpdates.category = updates.category;
        if (updates.endpointUrl) dbUpdates.endpoint_url = updates.endpointUrl;
        if (updates.pricePerCall) dbUpdates.price_per_call = updates.pricePerCall;
        if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;

        const { data, error } = await supabase
            .from('services')
            .update(dbUpdates)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Service not found' });
            }
            throw error;
        }

        res.json({ service: formatServiceForDiscovery(data) });
    } catch (error) {
        logger.error('Service update error', error as Error);
        res.status(500).json({ error: 'Failed to update service' });
    }
});

// ============================================
// METRICS ENDPOINTS
// ============================================

/**
 * GET /api/services/:id/metrics
 * 
 * Get time-series metrics for a service.
 */
router.get('/:id/metrics', async (req, res) => {
    try {
        const { id } = req.params;
        const {
            from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
            to = new Date().toISOString(),
            metric = 'reputation_score'
        } = req.query;

        const metrics = await temporalIndexer.getServiceMetrics(
            id,
            new Date(String(from)),
            new Date(String(to))
        );

        // Extract requested metric
        const data = metrics.map(m => ({
            timestamp: m.timestamp,
            value: m[metric as keyof typeof m]
        }));

        res.json({
            serviceId: id,
            metric,
            from,
            to,
            data
        });
    } catch (error) {
        logger.error('Metrics fetch error', error as Error);
        res.status(500).json({ error: 'Failed to fetch metrics' });
    }
});

// ============================================
// GRAPH ENDPOINTS
// ============================================

/**
 * GET /api/services/:id/dependencies
 * 
 * Get services that this service calls.
 */
router.get('/:id/dependencies', async (req, res) => {
    try {
        const { id } = req.params;
        const dependencies = await graphIndexer.getServiceDependencies(id);
        res.json({ serviceId: id, dependencies });
    } catch (error) {
        logger.error('Dependencies fetch error', error as Error);
        res.status(500).json({ error: 'Failed to fetch dependencies' });
    }
});

/**
 * GET /api/services/:id/dependents
 * 
 * Get services that call this service.
 */
router.get('/:id/dependents', async (req, res) => {
    try {
        const { id } = req.params;
        const dependents = await graphIndexer.getServiceDependents(id);
        res.json({ serviceId: id, dependents });
    } catch (error) {
        logger.error('Dependents fetch error', error as Error);
        res.status(500).json({ error: 'Failed to fetch dependents' });
    }
});

/**
 * GET /api/graph/path
 * 
 * Find paths between two services.
 */
router.get('/graph/path', async (req, res) => {
    try {
        const { from, to, maxDepth = 5 } = req.query;

        if (!from || !to) {
            return res.status(400).json({ error: 'from and to are required' });
        }

        const paths = await graphIndexer.findServicePath(
            String(from),
            String(to),
            Number(maxDepth)
        );

        res.json({
            from,
            to,
            paths,
            shortestPath: paths[0] || null
        });
    } catch (error) {
        logger.error('Path finding error', error as Error);
        res.status(500).json({ error: 'Failed to find path' });
    }
});

/**
 * GET /api/graph/all
 * 
 * Get all service relationships for visualization.
 */
router.get('/graph/all', async (req, res) => {
    try {
        const graph = await graphIndexer.getAllRelationships();
        res.json(graph);
    } catch (error) {
        logger.error('Graph fetch error', error as Error);
        res.status(500).json({ error: 'Failed to fetch graph' });
    }
});

// ============================================
// SCHEMA DISCOVERY ENDPOINTS
// ============================================

/**
 * GET /api/schemas/compatible
 * 
 * Find services with compatible input/output types.
 */
router.get('/schemas/compatible', async (req, res) => {
    try {
        const { inputType, outputType, tags, capabilities } = req.query;

        const { data, error } = await supabase.rpc('find_compatible_services', {
            p_input_type: inputType || null,
            p_output_type: outputType || null,
            p_tags: tags ? String(tags).split(',') : null,
            p_capabilities: capabilities ? String(capabilities).split(',') : null
        });

        if (error) throw error;

        res.json({ services: data });
    } catch (error) {
        logger.error('Compatible services error', error as Error);
        res.status(500).json({ error: 'Failed to find compatible services' });
    }
});

/**
 * GET /api/schemas/chainable/:id
 * 
 * Find services that can chain with a given service.
 */
router.get('/schemas/chainable/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const { data, error } = await supabase.rpc('find_chainable_services', {
            p_from_service_id: id
        });

        if (error) throw error;

        res.json({
            serviceId: id,
            chainableServices: data
        });
    } catch (error) {
        logger.error('Chainable services error', error as Error);
        res.status(500).json({ error: 'Failed to find chainable services' });
    }
});

/**
 * GET /api/schemas/workflow
 * 
 * Suggest workflows between input and output types.
 */
router.get('/schemas/workflow', async (req, res) => {
    try {
        const { startInputType, endOutputType, maxSteps = 3 } = req.query;

        if (!startInputType || !endOutputType) {
            return res.status(400).json({
                error: 'startInputType and endOutputType are required'
            });
        }

        const workflows = await graphIndexer.suggestWorkflows(
            String(startInputType),
            String(endOutputType),
            Number(maxSteps)
        );

        res.json({
            startInputType,
            endOutputType,
            workflows
        });
    } catch (error) {
        logger.error('Workflow suggestion error', error as Error);
        res.status(500).json({ error: 'Failed to suggest workflows' });
    }
});

// ============================================
// HELPERS
// ============================================

function formatServiceForDiscovery(data: Record<string, unknown>): FormattedService {
    const rep = Array.isArray(data.reputations)
        ? data.reputations[0] as Record<string, unknown> | undefined
        : data.reputations as Record<string, unknown> | undefined;

    const schema = Array.isArray(data.service_schemas)
        ? data.service_schemas[0] as Record<string, unknown> | undefined
        : data.service_schemas as Record<string, unknown> | undefined;

    const totalPayments = (rep?.total_payments as number) || 0;
    const successfulPayments = (rep?.successful_payments as number) || 0;

    return {
        id: data.id as string,
        name: data.name as string,
        description: data.description as string,
        category: data.category as string,
        endpointUrl: data.endpoint_url as string,
        pricePerCall: data.price_per_call as string,
        ownerAddress: data.owner_address as string,
        isActive: data.is_active as boolean,
        createdAt: data.created_at as string,
        lastActive: data.last_active as string,

        // Reputation metrics
        reputationScore: (rep?.reputation_score as number) || 0,
        totalPayments,
        successfulPayments,
        failedPayments: (rep?.failed_payments as number) || 0,
        avgLatencyMs: (rep?.avg_latency_ms as number) || 0,
        uniquePayers: (rep?.unique_payers as number) || 0,
        successRate: totalPayments > 0
            ? (successfulPayments / totalPayments) * 100
            : 0,

        // Schema info
        schema: schema ? {
            inputType: schema.input_type as string,
            outputType: schema.output_type as string,
            tags: (schema.tags as string[]) || [],
            capabilities: (schema.capabilities as string[]) || [],
            inputSchema: (schema.input_schema as Record<string, unknown>) || {},
            outputSchema: (schema.output_schema as Record<string, unknown>) || {},
            version: schema.schema_version as string
        } : null
    };
}

export default router;
