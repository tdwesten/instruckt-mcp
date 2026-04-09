import { readFile, writeFile, mkdir, unlink } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { Annotation, CreateAnnotationInput, UpdateAnnotationInput } from "./types.js";

export class InstrucktStorage {
  private filePath: string;
  private screenshotDir: string;
  private initialized = false;

  constructor(private dir: string) {
    this.filePath = join(dir, "annotations.json");
    this.screenshotDir = join(dir, "screenshots");
  }

  private async init(): Promise<void> {
    if (this.initialized) return;
    await mkdir(this.screenshotDir, { recursive: true });
    try {
      await readFile(this.filePath, "utf-8");
    } catch {
      await writeFile(this.filePath, "[]", "utf-8");
    }
    this.initialized = true;
  }

  private async read(): Promise<Annotation[]> {
    await this.init();
    const raw = await readFile(this.filePath, "utf-8");
    return JSON.parse(raw);
  }

  private async write(annotations: Annotation[]): Promise<void> {
    await writeFile(this.filePath, JSON.stringify(annotations, null, 2), "utf-8");
  }

  async getAll(): Promise<Annotation[]> {
    return this.read();
  }

  async getPending(): Promise<Annotation[]> {
    const all = await this.read();
    return all.filter((a) => !a.resolved);
  }

  async add(input: CreateAnnotationInput): Promise<Annotation> {
    const all = await this.read();
    const id = randomUUID();

    let screenshotFile: string | null = null;
    if (input.screenshot && input.screenshot.startsWith("data:")) {
      screenshotFile = `${id}.png`;
      const base64Data = input.screenshot.replace(/^data:image\/\w+;base64,/, "");
      await writeFile(join(this.screenshotDir, screenshotFile), Buffer.from(base64Data, "base64"));
    }

    const annotation: Annotation = {
      id,
      url: input.url,
      x: input.x,
      y: input.y,
      element: input.element,
      element_path: input.element_path,
      css_classes: input.css_classes ?? null,
      bounding_box: input.bounding_box ?? null,
      selected_text: input.selected_text ?? null,
      nearby_text: input.nearby_text ?? null,
      comment: input.comment,
      screenshot: screenshotFile,
      intent: input.intent ?? "fix",
      severity: input.severity ?? "important",
      framework: input.framework ?? null,
      resolved: false,
      created_at: new Date().toISOString(),
    };

    all.push(annotation);
    await this.write(all);
    return annotation;
  }

  async update(id: string, input: UpdateAnnotationInput): Promise<Annotation> {
    const all = await this.read();
    const index = all.findIndex((a) => a.id === id);
    if (index === -1) throw new Error(`Annotation ${id} not found`);

    if (input.severity === "dismissed") {
      const [annotation] = all.splice(index, 1);
      await this.write(all);
      if (annotation.screenshot) {
        await unlink(join(this.screenshotDir, annotation.screenshot)).catch(() => {});
      }
      return { ...annotation, severity: "dismissed" };
    }

    all[index] = { ...all[index], ...input };
    await this.write(all);
    return all[index];
  }

  async resolve(id: string): Promise<Annotation> {
    const all = await this.read();
    const index = all.findIndex((a) => a.id === id);
    if (index === -1) throw new Error(`Annotation ${id} not found`);
    const [annotation] = all.splice(index, 1);
    await this.write(all);
    if (annotation.screenshot) {
      await unlink(join(this.screenshotDir, annotation.screenshot)).catch(() => {});
    }
    return { ...annotation, resolved: true };
  }

  async getScreenshot(id: string): Promise<Buffer | null> {
    try {
      return await readFile(join(this.screenshotDir, `${id}.png`));
    } catch {
      return null;
    }
  }
}
