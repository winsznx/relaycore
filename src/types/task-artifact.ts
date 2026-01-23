/**
 * Task Artifact Types
 * 
 * Every action in Relay Core produces a TaskArtifact for auditability,
 * retry-safety, and workflow tracking.
 */

export type TaskState = 'idle' | 'pending' | 'settled' | 'failed';

export interface TaskArtifact {
    task_id: string;
    agent_id: string;
    service_id?: string;
    state: TaskState;
    payment_id?: string;
    facilitator_tx?: string;
    session_id?: string;
    retries: number;
    timestamps: {
        created: string;
        updated: string;
        completed?: string;
    };
    inputs: Record<string, unknown>;
    outputs: Record<string, unknown>;
    error?: {
        code: string;
        message: string;
        retryable: boolean;
    };
    metrics?: {
        total_ms: number;
        payment_ms?: number;
        service_ms?: number;
    };
}

export interface CreateTaskInput {
    agent_id: string;
    service_id?: string;
    session_id?: string;
    inputs: Record<string, unknown>;
}

export interface UpdateTaskInput {
    state?: TaskState;
    payment_id?: string;
    facilitator_tx?: string;
    outputs?: Record<string, unknown>;
    error?: TaskArtifact['error'];
    metrics?: TaskArtifact['metrics'];
}

export interface TaskQuery {
    agent_id?: string;
    service_id?: string;
    session_id?: string;
    state?: TaskState;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
}

export interface TaskStats {
    total: number;
    pending: number;
    settled: number;
    failed: number;
    success_rate: number;
    avg_duration_ms: number;
}
