import request from '../utils/requests';
import { PaginatedResponse } from '../types';

// ==================== Artifactory Instances ====================

export interface ArtifactoryInstance {
  id: number;
  name: string;
  url: string;
  username: string;
  description: string | null;
  is_active: boolean;
  create_time: string;
  update_time: string;
}

export interface TestConnectionResponse {
  status: 'ok' | 'error';
  message: string;
}

export const getArtifactoryInstances = (params?: any): Promise<any> =>
  request.get('/artifactory/instances/', { params }) as any;

export const getArtifactoryInstance = (id: number): Promise<ArtifactoryInstance> =>
  request.get(`/artifactory/instances/${id}/`) as any;

export const createArtifactoryInstance = (data: Partial<ArtifactoryInstance>): Promise<any> =>
  request.post('/artifactory/instances/', data) as any;

export const updateArtifactoryInstance = (id: number, data: Partial<ArtifactoryInstance>): Promise<any> =>
  request.patch(`/artifactory/instances/${id}/`, data) as any;

export const deleteArtifactoryInstance = (id: number): Promise<any> =>
  request.delete(`/artifactory/instances/${id}/`) as any;

export const testArtifactoryConnection = (id: number): Promise<TestConnectionResponse> =>
  request.get(`/artifactory/instances/${id}/test_connection/`) as any;

// ==================== Artifactory Repositories ====================

export type RepoType = 'maven' | 'npm' | 'generic' | 'helm' | 'docker' | 'pypi' | 'go' | 'other';

export interface ArtifactoryRepository {
  id: number;
  instance: number;
  instance_name: string;
  instance_url: string;
  repo_key: string;
  repo_type: RepoType;
  description: string | null;
  is_active: boolean;
  create_time: string;
  update_time: string;
}

export const getArtifactoryRepositories = (params?: any): Promise<PaginatedResponse<ArtifactoryRepository>> =>
  request.get('/artifactory/repositories/', { params }) as any;

export const getArtifactoryRepository = (id: number): Promise<ArtifactoryRepository> =>
  request.get(`/artifactory/repositories/${id}/`) as any;

export const createArtifactoryRepository = (data: Partial<ArtifactoryRepository>): Promise<any> =>
  request.post('/artifactory/repositories/', data) as any;

export const updateArtifactoryRepository = (id: number, data: Partial<ArtifactoryRepository>): Promise<any> =>
  request.patch(`/artifactory/repositories/${id}/`, data) as any;

export const deleteArtifactoryRepository = (id: number): Promise<any> =>
  request.delete(`/artifactory/repositories/${id}/`) as any;

// ==================== 产物管理扩展（Artifactory 来源） ====================

export type ArtifactSourceType = 'docker' | 'artifactory';
export type ArtifactType = 'docker_image' | 'jar' | 'npm_package' | 'pypi_package' | 'helm_chart' | 'binary' | 'other';

export interface Artifact {
  id: number;
  name: string;
  source_type: ArtifactSourceType;
  type: ArtifactType;
  // Docker / Harbor 字段
  image_registry: number | null;
  registry_name: string | null;
  // Artifactory 字段
  artifactory_repo: number | null;
  artifactory_repo_name: string | null;
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
  request.get(`/artifacts/${artifactId}/versions/`, params) as any;

export const createArtifactVersion = (data: Partial<ArtifactVersion>): Promise<any> =>
  request.post('/artifact-versions/', data) as any;

export const deleteArtifactVersion = (id: number): Promise<any> =>
  request.delete(`/artifact-versions/${id}/`) as any;
