export const RESUME_PROCESS_STEPS = [
  "Reading document",
  "Extracting contact & experience",
  "Detecting skills & education",
  "Finding social profiles",
  "Saving candidate profile",
] as const;

export function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function runWithProcessingSteps<T>(
  steps: readonly string[],
  onStep: (index: number, label: string) => void,
  task: () => Promise<T>,
  stepDelayMs = 700,
): Promise<T> {
  for (let i = 0; i < steps.length - 1; i++) {
    onStep(i, steps[i]);
    await delay(stepDelayMs);
  }
  onStep(steps.length - 1, steps[steps.length - 1]);
  const result = await task();
  await delay(400);
  return result;
}
