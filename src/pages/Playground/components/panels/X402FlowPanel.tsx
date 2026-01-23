/**
 * x402 Step-by-Step Execution Panel
 * 
 * Visualizes and executes all 9 steps of the x402 payment flow from ARCHITECTURE.md
 * Each step can be executed individually or all at once
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Play,
    Pause,
    RotateCcw,
    ChevronRight,
    CheckCircle,
    Circle,
    Loader2,
    AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export interface X402Step {
    number: number;
    actor: 'Client' | 'Server' | 'Facilitator';
    action: string;
    description: string;
    status: 'pending' | 'executing' | 'completed' | 'failed';
    data?: any;
    timestamp?: Date;
}

export interface X402FlowPanelProps {
    onExecuteStep: (stepNumber: number) => Promise<void>;
    onExecuteAll: () => Promise<void>;
    onReset: () => void;
    isExecuting: boolean;
}

const initialSteps: X402Step[] = [
    {
        number: 1,
        actor: 'Client',
        action: 'GET /api/resource',
        description: 'Client requests protected resource',
        status: 'pending'
    },
    {
        number: 2,
        actor: 'Server',
        action: '402 Payment Required',
        description: 'Server returns x402 challenge',
        status: 'pending'
    },
    {
        number: 3,
        actor: 'Client',
        action: 'Generate EIP-3009',
        description: 'Client creates payment authorization',
        status: 'pending'
    },
    {
        number: 4,
        actor: 'Client',
        action: 'POST /api/pay',
        description: 'Client submits payment header',
        status: 'pending'
    },
    {
        number: 5,
        actor: 'Server',
        action: 'Verify & Settle',
        description: 'Server forwards to facilitator',
        status: 'pending'
    },
    {
        number: 6,
        actor: 'Facilitator',
        action: 'Settlement OK',
        description: 'Facilitator confirms payment',
        status: 'pending'
    },
    {
        number: 7,
        actor: 'Server',
        action: '200 OK + paymentId',
        description: 'Server returns payment confirmation',
        status: 'pending'
    },
    {
        number: 8,
        actor: 'Client',
        action: 'GET + x-payment-id',
        description: 'Client requests resource with proof',
        status: 'pending'
    },
    {
        number: 9,
        actor: 'Server',
        action: '200 OK + content',
        description: 'Server delivers protected resource',
        status: 'pending'
    }
];

export function X402FlowPanel({
    onExecuteStep,
    onExecuteAll,
    onReset,
    isExecuting
}: X402FlowPanelProps) {
    const [steps, setSteps] = useState<X402Step[]>(initialSteps);
    const [currentStep, setCurrentStep] = useState(0);
    const [isExpanded, setIsExpanded] = useState(true);

    const getActorColor = (actor: string) => {
        switch (actor) {
            case 'Client': return 'bg-blue-100 text-blue-700 border-blue-300';
            case 'Server': return 'bg-purple-100 text-purple-700 border-purple-300';
            case 'Facilitator': return 'bg-green-100 text-green-700 border-green-300';
            default: return 'bg-gray-100 text-gray-700 border-gray-300';
        }
    };

    const getStatusIcon = (status: X402Step['status']) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="h-4 w-4 text-green-600" />;
            case 'executing':
                return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
            case 'failed':
                return <AlertCircle className="h-4 w-4 text-red-600" />;
            default:
                return <Circle className="h-4 w-4 text-gray-400" />;
        }
    };

    const handleExecuteStep = async (stepNumber: number) => {
        setSteps(prev => prev.map(s =>
            s.number === stepNumber
                ? { ...s, status: 'executing' }
                : s
        ));

        try {
            await onExecuteStep(stepNumber);
            setSteps(prev => prev.map(s =>
                s.number === stepNumber
                    ? { ...s, status: 'completed', timestamp: new Date() }
                    : s
            ));
            setCurrentStep(stepNumber);
        } catch (error) {
            setSteps(prev => prev.map(s =>
                s.number === stepNumber
                    ? { ...s, status: 'failed' }
                    : s
            ));
        }
    };

    const handleExecuteAll = async () => {
        for (let i = 1; i <= 9; i++) {
            await handleExecuteStep(i);
            await new Promise(resolve => setTimeout(resolve, 500));
        }
    };

    const handleReset = () => {
        setSteps(initialSteps);
        setCurrentStep(0);
        onReset();
    };

    const completedSteps = steps.filter(s => s.status === 'completed').length;
    const progress = (completedSteps / 9) * 100;

    return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
            {/* Header */}
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h3 className="font-semibold text-gray-900">x402 Payment Flow</h3>
                        <p className="text-xs text-gray-500">9-step execution from ARCHITECTURE.md</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            size="sm"
                            onClick={handleExecuteAll}
                            disabled={isExecuting}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            <Play className="h-3 w-3 mr-1" />
                            Execute All
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={handleReset}
                            disabled={isExecuting}
                        >
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Reset
                        </Button>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-600">Progress</span>
                        <span className="font-medium">{completedSteps}/9 steps</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            className="h-full bg-green-500"
                        />
                    </div>
                </div>
            </div>

            {/* Steps List */}
            <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
                {steps.map((step, index) => (
                    <motion.div
                        key={step.number}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className={`p-3 rounded-lg border-2 transition-all ${step.status === 'completed'
                                ? 'border-green-300 bg-green-50'
                                : step.status === 'executing'
                                    ? 'border-blue-300 bg-blue-50'
                                    : step.status === 'failed'
                                        ? 'border-red-300 bg-red-50'
                                        : 'border-gray-200 bg-white hover:border-gray-300'
                            }`}
                    >
                        <div className="flex items-start gap-3">
                            {/* Step Number & Status */}
                            <div className="flex-shrink-0 flex items-center gap-2">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold text-sm ${step.status === 'completed'
                                        ? 'bg-green-600 text-white'
                                        : step.status === 'executing'
                                            ? 'bg-blue-600 text-white'
                                            : 'bg-gray-200 text-gray-600'
                                    }`}>
                                    {step.number}
                                </div>
                                {getStatusIcon(step.status)}
                            </div>

                            {/* Step Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <Badge
                                        variant="outline"
                                        className={`text-xs ${getActorColor(step.actor)}`}
                                    >
                                        {step.actor}
                                    </Badge>
                                    <span className="font-semibold text-sm text-gray-900">
                                        {step.action}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-600 mb-2">
                                    {step.description}
                                </p>

                                {/* Step Data */}
                                {step.data && (
                                    <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                                        <pre className="text-xs font-mono text-gray-700 overflow-x-auto">
                                            {JSON.stringify(step.data, null, 2)}
                                        </pre>
                                    </div>
                                )}

                                {/* Timestamp */}
                                {step.timestamp && (
                                    <div className="text-xs text-gray-500 mt-1">
                                        {step.timestamp.toLocaleTimeString()}
                                    </div>
                                )}
                            </div>

                            {/* Execute Button */}
                            {step.status === 'pending' && (
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleExecuteStep(step.number)}
                                    disabled={isExecuting || (step.number > 1 && steps[step.number - 2].status !== 'completed')}
                                    className="flex-shrink-0"
                                >
                                    <ChevronRight className="h-3 w-3" />
                                </Button>
                            )}
                        </div>
                    </motion.div>
                ))}
            </div>
        </div>
    );
}

export default X402FlowPanel;
