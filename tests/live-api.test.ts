import { expect, it } from 'vitest';
import { createProject, askProject, getAIStatus } from '../lib/ai';
import { validateProject } from '../lib/validation';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

// Explicit opt-in: this test makes billable live Gemini calls. Never log keys or raw provider errors.
it.skipIf(process.env.RUN_LIVE_GEMINI !== '1')('generates, answers, and revises a real project with the configured premium Gemini model', async () => {
  const status = await getAIStatus();
  expect(status.configured).toBe(true); expect(status.available, status.message).toBe(true);
  const stages: string[] = [];
  const events: { message: string; parts?: string[]; receivedAt: string }[] = [];
  const record = (event: { message: string; parts?: string[] }) => { stages.push(event.message); events.push({ ...event, receivedAt: new Date().toISOString() }); console.info(`[live Gemini] ${event.message}`); };
  const project = await createProject({ prompt: 'Build a small desk temperature and humidity monitor using an ESP32 DevKit, a bare DHT22 sensor with its 10k pull-up resistor, and a 128x64 SSD1306 OLED. Power from USB, fit parts in an illustrative case, and show temperature in Celsius and humidity. Use fitted headers and no soldering.', skillLevel: 'beginner', action: 'generate' }, record);
  expect(project.source, project.message).toBe('gemini'); expect(validateProject(project.project).valid).toBe(true);
  const answer = await askProject({ project: project.project, question: 'Which exact pins connect the OLED to the ESP32, and what voltage powers the display?' });
  expect(answer.source).toBe('gemini'); expect(answer.answer.length).toBeGreaterThan(40); expect(answer.answer).toMatch(/3[.,]3/); expect(answer.answer).toContain('21'); expect(answer.answer).toContain('22');
  const edited = await createProject({ prompt: project.project.prompt, skillLevel: 'beginner', project: project.project, action: 'edit', request: 'Add a passive piezo buzzer that sounds a short warning when temperature is above 30 degrees Celsius. Keep the sensor, display, USB power, and existing purpose. Update the parts, all wiring, assembly instructions and complete Arduino sketch together.' }, record);
  expect(edited.source, edited.message).toBe('gemini'); expect(validateProject(edited.project).valid).toBe(true);
  const evidencePath = resolve(process.cwd(), '../../work/gemini-live-evidence.json');
  await mkdir(resolve(evidencePath, '..'), { recursive: true });
  await writeFile(evidencePath, JSON.stringify({ checkedAt: new Date().toISOString(), model: project.model, source: project.source, transport: 'Gemini streamGenerateContent SSE', generatedProject: project.project, questionAnswer: answer, editedProject: edited.project, stages, events, limitation: 'Generated wiring passed deterministic project checks. This does not establish compilation or physical hardware behavior.' }, null, 2));
  expect(edited.project.parts.some(part => part.libraryId === 'piezo-buzzer')).toBe(true); expect(edited.project.code.source.includes('30')).toBe(true);
  // Passive piezos can use tone, hardware PWM, or an explicit timed digital waveform.
  expect(/tone\s*\(|ledc|delayMicroseconds\s*\(/.test(edited.project.code.source), 'The passive piezo needs an actual waveform, not just a constant HIGH.').toBe(true);
  console.info(`[live Gemini] PASS: generated, answered, edited with ${project.model}; both projects passed deterministic validation.`);
}, 600_000);
