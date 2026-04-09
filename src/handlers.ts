import type { InstrucktStorage } from "./storage.js";
import type { Annotation, CreateAnnotationInput, UpdateAnnotationInput } from "./types.js";

export function createRequestHandlers(storage: InstrucktStorage) {
  return {
    async getAnnotations(): Promise<Annotation[]> {
      return storage.getAll();
    },
    async createAnnotation(input: CreateAnnotationInput): Promise<Annotation> {
      return storage.add(input);
    },
    async updateAnnotation(id: string, input: UpdateAnnotationInput): Promise<Annotation> {
      return storage.update(id, input);
    },
  };
}
