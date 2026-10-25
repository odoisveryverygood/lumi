# Morf — project explanation draft

Morf is an AI design partner for hardware makers modifying 3D assemblies before prototyping. Makers can explore individual parts, describe a change and inspect rendered feedback with measured geometric checks. The demonstrated fan study finds a deliberately seeded movement conflict and repairs it under a frozen range, clearance requirement and shape-preservation rule.

Gemini 4 Argon reviews the assembly, actual static and posed renders, and measured conflicts, then proposes a permitted correction. Morf re-renders and rechecks the result before the user accepts it. In the fresh October 25 run on revision 3f26257, two provider review rounds completed in 36.085 seconds. The correction passed 19 sampled tilt poses with 0.815 mm minimum clearance against a 0.5 mm requirement. An offline check reproduced the stored geometric measurements and verified all 12 image hashes.

The current integration uses direct Argon calls, not Google Managed Agents. Finite sampled geometry is not continuous-motion or physical-hardware certification. A maker study, a live held-out model benchmark and a fully spoken three-minute rehearsal remain pending. This is project copy grounded in the implemented demonstration, not a claim of award eligibility or guaranteed results.
