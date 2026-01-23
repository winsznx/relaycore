/**
 * RWA MCP Tools
 * 
 * Production-grade MCP tools for RWA state machine management.
 * Enables Claude to create, transition, query, and manage RWA lifecycles.
 */

import type { Tool } from '@modelcontextprotocol/sdk/types.js';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

export const rwaTools: Record<string, Tool> = {
    rwa_state_create: {
        name: 'rwa_state_create',
        description: 'Create a new RWA state machine for tracking real-world asset lifecycle. Returns the created state machine with initial state "created".',
        inputSchema: {
            type: 'object',
            properties: {
                rwaId: {
                    type: 'string',
                    description: 'Unique identifier for the RWA (e.g., invoice_12345, shipment_abc)'
                },
                metadata: {
                    type: 'object',
                    description: 'Additional metadata about the RWA (e.g., asset type, value, parties involved)',
                    properties: {
                        assetType: { type: 'string' },
                        value: { type: 'string' },
                        description: { type: 'string' }
                    }
                }
            },
            required: ['rwaId']
        }
    },

    rwa_state_transition: {
        name: 'rwa_state_transition',
        description: 'Trigger a state transition for an RWA. This requires x402 payment to the agent performing the transition. Returns 402 if payment not provided, or transition details if successful.',
        inputSchema: {
            type: 'object',
            properties: {
                rwaId: {
                    type: 'string',
                    description: 'The RWA identifier'
                },
                toState: {
                    type: 'string',
                    enum: ['created', 'verified', 'escrowed', 'in_process', 'fulfilled', 'settled', 'disputed'],
                    description: 'Target state for the transition'
                },
                agentAddress: {
                    type: 'string',
                    description: 'Ethereum address of the agent performing this transition'
                },
                agentRole: {
                    type: 'string',
                    enum: ['verifier', 'escrow_manager', 'executor', 'delivery_confirmer', 'settler', 'auditor'],
                    description: 'Role of the agent (must match required role for transition)'
                },
                paymentHeader: {
                    type: 'string',
                    description: 'x402 payment header (if retrying after 402 response)'
                },
                paymentRequirements: {
                    type: 'object',
                    description: 'Payment requirements from previous 402 response'
                }
            },
            required: ['rwaId', 'toState', 'agentAddress', 'agentRole']
        }
    },

    rwa_state_query: {
        name: 'rwa_state_query',
        description: 'Query the current state of an RWA state machine. Returns current state, previous state, metadata, and timestamps.',
        inputSchema: {
            type: 'object',
            properties: {
                rwaId: {
                    type: 'string',
                    description: 'The RWA identifier to query'
                }
            },
            required: ['rwaId']
        }
    },

    rwa_transition_history: {
        name: 'rwa_transition_history',
        description: 'Get the complete transition history for an RWA. Returns all state transitions with agent info, payment hashes, and timestamps.',
        inputSchema: {
            type: 'object',
            properties: {
                rwaId: {
                    type: 'string',
                    description: 'The RWA identifier'
                }
            },
            required: ['rwaId']
        }
    },

    rwa_settlement_verify: {
        name: 'rwa_settlement_verify',
        description: 'Verify that an RWA has been properly settled. Checks if RWA reached "settled" state and all transitions have valid payment proofs.',
        inputSchema: {
            type: 'object',
            properties: {
                rwaId: {
                    type: 'string',
                    description: 'The RWA identifier to verify'
                }
            },
            required: ['rwaId']
        }
    },

    rwa_list_all: {
        name: 'rwa_list_all',
        description: 'List all RWA state machines in the system. Useful for discovering existing RWAs and their current states.',
        inputSchema: {
            type: 'object',
            properties: {
                state: {
                    type: 'string',
                    enum: ['created', 'verified', 'escrowed', 'in_process', 'fulfilled', 'settled', 'disputed'],
                    description: 'Optional: filter by current state'
                }
            }
        }
    }
};

/**
 * Tool handlers for RWA operations
 */
export const rwaToolHandlers = {
    async rwa_state_create(args: { rwaId: string; metadata?: Record<string, unknown> }) {
        const response = await fetch(`${API_BASE_URL}/api/rwa/state-machine/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(args)
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to create RWA: ${error.error || response.statusText}`);
        }

        return await response.json();
    },

    async rwa_state_transition(args: {
        rwaId: string;
        toState: string;
        agentAddress: string;
        agentRole: string;
        paymentHeader?: string;
        paymentRequirements?: Record<string, unknown>;
    }) {
        const response = await fetch(`${API_BASE_URL}/api/rwa/state-machine/${args.rwaId}/transition`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(args)
        });

        const data = await response.json();

        if (response.status === 402) {
            return {
                status: 402,
                message: 'Payment Required',
                paymentRequirements: data.paymentRequirements,
                instructions: 'Use the paymentRequirements to generate an x402 payment, then retry this call with paymentHeader and paymentRequirements'
            };
        }

        if (!response.ok) {
            throw new Error(`Transition failed: ${data.error || response.statusText}`);
        }

        return data;
    },

    async rwa_state_query(args: { rwaId: string }) {
        const response = await fetch(`${API_BASE_URL}/api/rwa/state-machine/${args.rwaId}/state`);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to query RWA: ${error.error || response.statusText}`);
        }

        return await response.json();
    },

    async rwa_transition_history(args: { rwaId: string }) {
        const response = await fetch(`${API_BASE_URL}/api/rwa/state-machine/${args.rwaId}/history`);

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to get history: ${error.error || response.statusText}`);
        }

        return await response.json();
    },

    async rwa_settlement_verify(args: { rwaId: string }) {
        const historyResponse = await fetch(`${API_BASE_URL}/api/rwa/state-machine/${args.rwaId}/history`);
        const stateResponse = await fetch(`${API_BASE_URL}/api/rwa/state-machine/${args.rwaId}/state`);

        if (!historyResponse.ok || !stateResponse.ok) {
            throw new Error('Failed to verify settlement');
        }

        const history = await historyResponse.json();
        const state = await stateResponse.json();

        const isSettled = state.currentState === 'settled';
        const allTransitionsHavePayments = history.transitions.every((t: any) => t.paymentHash);
        const transitionCount = history.transitions.length;

        return {
            rwaId: args.rwaId,
            isSettled,
            allPaymentsVerified: allTransitionsHavePayments,
            transitionCount,
            currentState: state.currentState,
            verdict: isSettled && allTransitionsHavePayments ? 'VERIFIED' : 'INCOMPLETE'
        };
    },

    async rwa_list_all(args: { state?: string }) {
        const url = new URL(`${API_BASE_URL}/api/rwa/state-machines`);
        if (args.state) {
            url.searchParams.set('state', args.state);
        }

        const response = await fetch(url.toString());

        if (!response.ok) {
            const error = await response.json();
            throw new Error(`Failed to list RWAs: ${error.error || response.statusText}`);
        }

        return await response.json();
    }
};
