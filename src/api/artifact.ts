import request from '../utils/requests';
import { PaginatedResponse } from '../types';

export interface Artifact {
    id: number;
    name: string;
    type: string;
    registry: number | null;
    registry_name: string | null;
    repository: string | null;
    latest_tag: string | null;
    latest_digest: string | null;
    latest_size: number;
    description: string | null;
    pipeline: number | null;
    pipeline_name: string | null;
    version_count: number;
    versions: ArtifactVersion[];
    create_time: string;
    update_time: string;
}

export interface ArtifactVersion {
    id: number;
    artifact: number;
    artifact_name: string;
    tag: string;
    digest: string | null;
    size: number;
    image_url: string | null;
    build_user: string | null;
    commit_sha: string | null;
    pipeline_run: number | null;
    metadata: Record<string, any>;
    create_time: string;
    update_time: string;
}

export const getArtifacts = (params?: any): Promise<PaginatedResponse<Artifact>> =>
    request.get('/artifacts/', { params }) as any;

export const getArtifact = (id: number): Promise<Artifact> =>
    request.get(`/artifacts/${id}/`) as any;

export const createArtifact = (data: Partial<Artifact>): Promise<any> =>
    request.post('/artifacts/', data) as any;

export const updateArtifact = (id: number, data: Partial<Artifact>): Promise<any> =>
    request.put(`/artifacts/${id}/`, data) as any;

export const deleteArtifact = (id: number): Promise<any> =>
    request.delete(`/artifacts/${id}/`) as any;

export const getArtifactVersions = (params?: any): Promise<PaginatedResponse<ArtifactVersion>> =>
    request.get('/artifact-versions/', { params }) as any;

export const getArtifactVersionsById = (artifactId: number, params?: any): Promise<PaginatedResponse<ArtifactVersion>> =>
    request.get(`/artifacts/${artifactId}/versions/`, { params }) as any;

export const createArtifactVersion = (data: Partial<ArtifactVersion>): Promise<any> =>
    request.post('/artifact-versions/', data) as any;

export const deleteArtifactVersion = (id: number): Promise<any> =>
    request.delete(`/artifact-versions/${id}/`) as any;
