/**
 * RWA State Machine Visualizer
 * 
 * Production-grade component for visualizing RWA lifecycle states and transitions.
 * Shows current state, available transitions, agent assignments, and payment history.
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    CheckCircle2, Clock, ArrowRight, DollarSign, User, Shield,
    AlertCircle, Loader2, RefreshCw
} from 'lucide-react';

interface RWAStateMachineProps {
    rwaId: string;
    onTransition?: (toState: string) => void;
}

interface StateMachine {
    rwaId: string;
    currentState: string;
    previousState: string | null;
    metadata: Record<string, unknown>;
    updatedAt: string;
}

interface Transition {
    id: string;
    fromState: string;
    toState: string;
    agentAddress: string;
    agentRole: string;
    paymentHash: string;
    transitionedAt: string;
}

interface NextState {
    state: string;
    cost: string;
    requiredRole: string | null;
}

const STATE_COLORS: Record<string, string> = {
    created: 'bg-gray-100 text-gray-700 border-gray-300',
    verified: 'bg-blue-100 text-blue-700 border-blue-300',
    escrowed: 'bg-purple-100 text-purple-700 border-purple-300',
    in_process: 'bg-yellow-100 text-yellow-700 border-yellow-300',
    fulfilled: 'bg-green-100 text-green-700 border-green-300',
    settled: 'bg-emerald-100 text-emerald-700 border-emerald-300',
    disputed: 'bg-red-100 text-red-700 border-red-300'
};

const STATE_ICONS: Record<string, typeof CheckCircle2> = {
    created: Clock,
    verified: CheckCircle2,
    escrowed: Shield,
    in_process: Loader2,
    fulfilled: CheckCircle2,
    settled: CheckCircle2,
    disputed: AlertCircle
};

export function RWAStateMachine({ rwaId, onTransition }: RWAStateMachineProps) {
    const [stateMachine, setStateMachine] = useState<StateMachine | null>(null);
    const [transitions, setTransitions] = useState<Transition[]>([]);
    const [nextStates, setNextStates] = useState<NextState[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadData = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const [stateRes, historyRes, nextRes] = await Promise.all([
                fetch(`/api/rwa/state-machine/${rwaId}/state`),
                fetch(`/api/rwa/state-machine/${rwaId}/history`),
                fetch(`/api/rwa/state-machine/${rwaId}/next-states`)
            ]);

            if (!stateRes.ok) throw new Error('Failed to load state');

            const stateData = await stateRes.json();
            const historyData = await historyRes.json();
            const nextData = await nextRes.json();

            setStateMachine(stateData);
            setTransitions(historyData.transitions || []);
            setNextStates(nextData.nextStates || []);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [rwaId]);

    if (isLoading) {
        return (
            <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                <CardContent className="p-12 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </CardContent>
            </Card>
        );
    }

    if (error || !stateMachine) {
        return (
            <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                <CardContent className="p-12 text-center">
                    <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <p className="text-gray-600">{error || 'State machine not found'}</p>
                    <Button onClick={loadData} variant="outline" className="mt-4">
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Retry
                    </Button>
                </CardContent>
            </Card>
        );
    }

    const StateIcon = STATE_ICONS[stateMachine.currentState] || Clock;

    return (
        <div className="space-y-6">
            <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-xl font-bold">RWA State Machine</CardTitle>
                        <Button onClick={loadData} variant="ghost" size="sm">
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                    <p className="text-sm text-gray-500 font-mono">{rwaId}</p>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="flex items-center justify-center py-8">
                        <div className="relative">
                            <div className={`h-32 w-32 rounded-full border-4 ${STATE_COLORS[stateMachine.currentState]} flex items-center justify-center`}>
                                <StateIcon className="h-16 w-16" />
                            </div>
                            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap">
                                <Badge className={STATE_COLORS[stateMachine.currentState]}>
                                    {stateMachine.currentState.toUpperCase().replace('_', ' ')}
                                </Badge>
                            </div>
                        </div>
                    </div>

                    {stateMachine.previousState && (
                        <div className="text-center text-sm text-gray-500">
                            Previous: <span className="font-semibold">{stateMachine.previousState}</span>
                        </div>
                    )}

                    {nextStates.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-gray-700">Available Transitions</h3>
                            <div className="grid gap-3">
                                {nextStates.map((next) => (
                                    <div
                                        key={next.state}
                                        className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <ArrowRight className="h-5 w-5 text-gray-400" />
                                            <div>
                                                <p className="font-semibold text-gray-900">
                                                    {next.state.replace('_', ' ').toUpperCase()}
                                                </p>
                                                {next.requiredRole && (
                                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                                        <User className="h-3 w-3" />
                                                        {next.requiredRole.replace('_', ' ')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="text-right">
                                                <p className="text-sm font-mono font-bold text-gray-900">
                                                    {next.cost} USDC
                                                </p>
                                                <p className="text-xs text-gray-500">x402 payment</p>
                                            </div>
                                            {onTransition && (
                                                <Button
                                                    size="sm"
                                                    onClick={() => onTransition(next.state)}
                                                    className="bg-blue-600 hover:bg-blue-700"
                                                >
                                                    Transition
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {nextStates.length === 0 && stateMachine.currentState === 'settled' && (
                        <div className="text-center py-6 bg-green-50 rounded-lg border border-green-200">
                            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto mb-2" />
                            <p className="font-semibold text-green-900">RWA Settled</p>
                            <p className="text-sm text-green-700">All transitions complete</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {transitions.length > 0 && (
                <Card className="border-0 shadow-sm ring-1 ring-gray-100">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold">Transition History</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {transitions.map((t, idx) => (
                                <div
                                    key={t.id}
                                    className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg"
                                >
                                    <div className="flex flex-col items-center">
                                        <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm font-bold">
                                            {transitions.length - idx}
                                        </div>
                                        {idx < transitions.length - 1 && (
                                            <div className="w-0.5 h-8 bg-gray-300 my-1" />
                                        )}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Badge className={STATE_COLORS[t.fromState]}>
                                                {t.fromState}
                                            </Badge>
                                            <ArrowRight className="h-4 w-4 text-gray-400" />
                                            <Badge className={STATE_COLORS[t.toState]}>
                                                {t.toState}
                                            </Badge>
                                        </div>
                                        <div className="text-sm text-gray-600 space-y-1">
                                            <p className="flex items-center gap-2">
                                                <User className="h-3 w-3" />
                                                <span className="font-semibold">{t.agentRole.replace('_', ' ')}</span>
                                                <span className="font-mono text-xs">{t.agentAddress.slice(0, 10)}...</span>
                                            </p>
                                            <p className="flex items-center gap-2">
                                                <DollarSign className="h-3 w-3" />
                                                <span className="font-mono text-xs">{t.paymentHash.slice(0, 20)}...</span>
                                            </p>
                                            <p className="text-xs text-gray-400">
                                                {new Date(t.transitionedAt).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
