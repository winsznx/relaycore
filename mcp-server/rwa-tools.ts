/**
 * RWA State Machine MCP Tools Registration
 * 
 * Provides MCP tools for managing RWA state machines with x402 payment enforcement.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const API_BASE_URL = process.env.RELAY_CORE_API_URL || 'http://localhost:4001';

function formatContent(data: unknown): { content: Array<{ type: 'text'; text: string }> } {
    return {
        content: [{
            type: 'text' as const,
            text: JSON.stringify(data, null, 2)
        }]
    };
}

function errorContent(message: string): { content: Array<{ type: 'text'; text: string }> } {
    return {
        content: [{
            type: 'text' as const,
            text: JSON.stringify({ error: message }, null, 2)
        }]
    };
}

export function registerRWATools(server: McpServer): void {
    console.error('[RWA Tools] Registering RWA state machine tools...');

    // Create RWA State Machine
    server.tool(
        "rwa_state_create",
        {
            rwaId: z.string().describe("Unique identifier for the RWA (e.g., invoice_12345, shipment_abc)"),
            metadata: z.record(z.unknown()).optional().describe("Additional metadata about the RWA")
        },
        async ({ rwaId, metadata }) => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/rwa/state-machine/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ rwaId, metadata: metadata || {} })
                });

                if (!response.ok) {
                    const error = await response.json();
                    return errorContent(error.error || response.statusText);
                }

                const data = await response.json();
                return formatContent(data);
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Failed to create RWA');
            }
        }
    );

    // Trigger State Transition
    server.tool(
        "rwa_state_transition",
        {
            rwaId: z.string().describe("The RWA identifier"),
            toState: z.enum(['created', 'verified', 'escrowed', 'in_process', 'fulfilled', 'settled', 'disputed']).describe("Target state"),
            agentAddress: z.string().describe("Ethereum address of the agent"),
            agentRole: z.enum(['verifier', 'escrow_manager', 'executor', 'delivery_confirmer', 'settler', 'auditor']).describe("Agent role"),
            paymentHeader: z.string().optional().describe("x402 payment header (if retrying after 402)"),
            paymentRequirements: z.record(z.unknown()).optional().describe("Payment requirements from 402 response")
        },
        async ({ rwaId, toState, agentAddress, agentRole, paymentHeader, paymentRequirements }) => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/rwa/state-machine/${rwaId}/transition`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        toState,
                        agentAddress,
                        agentRole,
                        paymentHeader,
                        paymentRequirements
                    })
                });

                const data = await response.json();

                if (response.status === 402) {
                    return formatContent({
                        status: 402,
                        message: 'Payment Required',
                        paymentRequirements: data.paymentRequirements,
                        instructions: 'Use the paymentRequirements to generate an x402 payment, then retry with paymentHeader and paymentRequirements'
                    });
                }

                if (!response.ok) {
                    return errorContent(data.error || response.statusText);
                }

                return formatContent(data);
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Transition failed');
            }
        }
    );

    // Query RWA State
    server.tool(
        "rwa_state_query",
        {
            rwaId: z.string().describe("The RWA identifier to query")
        },
        async ({ rwaId }) => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/rwa/state-machine/${rwaId}/state`);

                if (!response.ok) {
                    const error = await response.json();
                    return errorContent(error.error || response.statusText);
                }

                const data = await response.json();
                return formatContent(data);
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Failed to query RWA');
            }
        }
    );

    // Get Transition History
    server.tool(
        "rwa_transition_history",
        {
            rwaId: z.string().describe("The RWA identifier")
        },
        async ({ rwaId }) => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/rwa/state-machine/${rwaId}/history`);

                if (!response.ok) {
                    const error = await response.json();
                    return errorContent(error.error || response.statusText);
                }

                const data = await response.json();
                return formatContent(data);
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Failed to get history');
            }
        }
    );

    // Get Next Valid States
    server.tool(
        "rwa_next_states",
        {
            rwaId: z.string().describe("The RWA identifier")
        },
        async ({ rwaId }) => {
            try {
                const response = await fetch(`${API_BASE_URL}/api/rwa/state-machine/${rwaId}/next-states`);

                if (!response.ok) {
                    const error = await response.json();
                    return errorContent(error.error || response.statusText);
                }

                const data = await response.json();
                return formatContent(data);
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Failed to get next states');
            }
        }
    );

    // Verify Settlement
    server.tool(
        "rwa_settlement_verify",
        {
            rwaId: z.string().describe("The RWA identifier to verify")
        },
        async ({ rwaId }) => {
            try {
                const [historyResponse, stateResponse] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/rwa/state-machine/${rwaId}/history`),
                    fetch(`${API_BASE_URL}/api/rwa/state-machine/${rwaId}/state`)
                ]);

                if (!historyResponse.ok || !stateResponse.ok) {
                    return errorContent('Failed to verify settlement');
                }

                const history = await historyResponse.json();
                const state = await stateResponse.json();

                const isSettled = state.currentState === 'settled';
                const allTransitionsHavePayments = history.transitions.every((t: any) => t.paymentHash);
                const transitionCount = history.transitions.length;

                return formatContent({
                    rwaId,
                    isSettled,
                    allPaymentsVerified: allTransitionsHavePayments,
                    transitionCount,
                    currentState: state.currentState,
                    verdict: isSettled && allTransitionsHavePayments ? 'VERIFIED' : 'INCOMPLETE'
                });
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Verification failed');
            }
        }
    );

    // List All RWAs
    server.tool(
        "rwa_list_all",
        {
            state: z.enum(['created', 'verified', 'escrowed', 'in_process', 'fulfilled', 'settled', 'disputed']).optional().describe("Filter by state")
        },
        async ({ state }) => {
            try {
                const url = new URL(`${API_BASE_URL}/api/rwa/state-machines`);
                if (state) {
                    url.searchParams.set('state', state);
                }

                const response = await fetch(url.toString());

                if (!response.ok) {
                    const error = await response.json();
                    return errorContent(error.error || response.statusText);
                }

                const data = await response.json();
                return formatContent(data);
            } catch (error) {
                return errorContent(error instanceof Error ? error.message : 'Failed to list RWAs');
            }
        }
    );

    console.error('[RWA Tools] Registered 7 RWA state machine tools successfully');
}
