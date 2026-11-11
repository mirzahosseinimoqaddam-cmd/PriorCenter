# EinsteLab

EinsteLab is a 2D physics laboratory for phones, in English and Farsi. It covers high-school physics (grades 10–12 of the Iranian curriculum) and first-year university topics. There are 61 guided experiments in 11 labs. Each one sets up the table, runs a real simulation in SI units and checks the result against the textbook formula as it runs.

## Labs

| Lab | What you can do |
|---|---|
| Motion & collisions | Throw, bounce and stack objects; pendulums, springs, ramps with friction, a projectile launcher; every impact shows Δp, average force and acceleration |
| Magnetism | Bar, disc, sphere and horseshoe magnets, electromagnets, compasses, iron filings, induced magnetism, current-carrying wires, a Faraday induction coil |
| Electric fields | Fixed charges and light pith balls, parallel plates, field lines and potential maps |
| Electric circuits | Wire cells, resistors, bulbs, switches, capacitors, ammeters and voltmeters by dragging between terminals; solved with nodal analysis every frame |
| Charged particles | Electron, proton and alpha guns in electric and magnetic fields (Boris integrator on a slowed clock) |
| Optics | Lasers, ray boxes, point and white sources; plane and concave mirrors, thin lenses, glass blocks, half-discs, a dispersing prism and a screen |
| Sound | Speakers and microphones on a slowed clock: wavefronts, pressure maps, loudness in dB, interference, the Doppler effect, a driven string |
| Heat & gases | An ideal-gas cylinder with a heater and a fixed or free piston, a calorimeter, and a bar that conducts heat |
| Fluids | A tank of water, salt water, oil or mercury with buoyancy and drag; a pressure probe, a Venturi pipe and a draining jar |
| Gravity & orbits | A satellite around Earth, the Moon or Mars with real G, masses and radii |
| Modern physics | The photoelectric effect, the Bohr hydrogen atom and its spectrum, radioactive decay, and relativistic light clocks |

## Experiments

### Motion & collisions (8)

| Experiment | Level | Checked against |
|---|---|---|
| Free fall | Grade 12 | v = √(2gh) |
| Simple pendulum | Grade 12 | T = 2π√(L/g) · (1 + θ₀²/16) |
| Mass on a spring | Grade 12 | T = 2π√(m/k) |
| Momentum in a collision | Grade 12 | Σp before = Σp after |
| Sliding down an incline | Grade 12 | a = g(sin θ − μ cos θ) |
| Rolling down an incline | University | Solid ball rolling: a = (5/7)·g·sin θ |
| Projectile motion | Grade 12 | Range: R = v·cos θ·(v sin θ + √(v² sin²θ + 2gh)) / g |
| Conservation of energy | Grade 10 | m·g·h = ½·m·v²  ⇒  v = √(2gL(1 − cos θ)) |

### Magnetism (8)

| Experiment | Level | Checked against |
|---|---|---|
| Like and unlike poles | Grade 10 | N–N repel · N–S attract |
| Field of a bar magnet | Grade 11 | Far on the axis: B = μ₀·2m / 4πr³ (m = pole strength × magnetic length) |
| Horseshoe magnet | Grade 11 | Between the poles the field is nearly uniform |
| Oersted: field of a wire | Grade 11 | B = μ₀I / 2πr |
| Two parallel currents | Grade 11 | F/L = μ₀I₁I₂ / 2πd |
| Electromagnet | Grade 11 | m = N·I·A × core gain |
| Induced magnetism | Grade 11 | Iron facing N becomes S at that end |
| Faraday's law of induction | Grade 11 | ε = −N·ΔΦ/Δt |

### Electric fields (3)

| Experiment | Level | Checked against |
|---|---|---|
| Coulomb's law | Grade 11 | F = k·q₁q₂ / r² |
| Electric dipole | Grade 11 | V = 0 on the mid-line of ±q |
| Charging by contact | Grade 11 | Touching spheres share charge: q ∝ R |

### Electric circuits (7)

| Experiment | Level | Checked against |
|---|---|---|
| Ohm's law | Grade 11 | I = V / R |
| Resistors in series | Grade 11 | R = R₁ + R₂ · the same current flows through both |
| Resistors in parallel | Grade 11 | 1/R = 1/R₁ + 1/R₂ |
| Kirchhoff's junction rule | Grade 11 | I = I₁ + I₂ |
| EMF and internal resistance | Grade 11 | V = ε − I·r |
| Bulbs in series and parallel | Grade 11 | P = V²/R: each parallel bulb gets 4× the power of a series one |
| Charging a capacitor | University | V = ε(1 − e^(−t/RC)) · τ = RC |

### Charged particles (3)

| Experiment | Level | Checked against |
|---|---|---|
| Electron in a magnetic field | Grade 11 | r = m·v / (\|q\|·B) |
| Electron deflection (CRT) | University | y = qE·L² / 2mv² |
| Velocity selector | University | Straight through when v = E / B |

### Optics (7)

| Experiment | Level | Checked against |
|---|---|---|
| Law of reflection | Grade 10 | θᵢ = θᵣ |
| Refraction (Snell's law) | Grade 10 | n₁ sin θ₁ = n₂ sin θ₂ |
| Total internal reflection | Grade 10 | Above θc = arcsin(1/n) no light escapes |
| Dispersion in a prism | Grade 10 | n is larger for violet than for red, so violet bends more |
| Focal point of a lens | Grade 11 | Parallel rays meet at F, a distance f behind the lens |
| Lens equation | Grade 11 | 1/f = 1/d₀ + 1/dᵢ |
| Concave mirror | Grade 11 | f = R / 2 |

### Sound (5)

| Experiment | Level | Checked against |
|---|---|---|
| Wavelength of sound | Grade 12 | λ = v / f |
| Sound level and distance | Grade 12 | Double the distance: ΔL = −20 log₁₀(r₂/r₁) ≈ −6 dB |
| Doppler effect | Grade 12 | Approaching source: f′ = f · v / (v − vₛ) |
| Interference of two speakers | University | Path difference 0: loud · λ/2: quiet |
| Standing waves on a string | Grade 12 | f₁ = v / 2L, v = √(F / μ) |

### Heat & gases (6)

| Experiment | Level | Checked against |
|---|---|---|
| Boyle's law | Grade 10 | P·V = n·R·T: at fixed T, P·V stays the same |
| Charles's law | Grade 10 | At fixed P: V / T stays the same |
| Pressure law | Grade 10 | At fixed V: P / T stays the same |
| Molecular speeds | University | Mean speed (2D): v̄ = √(πkT / 2m) |
| Calorimetry | Grade 10 | T = (m₁c₁T₁ + m₂c₂T₂) / (m₁c₁ + m₂c₂) |
| Heat conduction | Grade 10 | H = k·A·ΔT / L |

### Fluids (6)

| Experiment | Level | Checked against |
|---|---|---|
| Pressure in a liquid | Grade 10 | p = p₀ + ρ·g·h |
| Archimedes' principle | Grade 10 | A floating body sinks until it displaces its own weight: fraction under = ρ_body / ρ_liquid |
| Floating and sinking | Grade 10 | An object floats if ρ_object < ρ_liquid |
| Weighing in water | Grade 10 | Reading = m·g − ρ·V·g |
| Continuity and Bernoulli | University | A₁v₁ = A₂v₂ · p₁ − p₂ = ½ρ(v₂² − v₁²) |
| Torricelli's law | University | v = √(2gh) |

### Gravity & orbits (3)

| Experiment | Level | Checked against |
|---|---|---|
| Circular orbit | Grade 12 | v = √(GM / r) · T = 2πr / v |
| Kepler's third law | Grade 12 | T² = 4π²a³ / GM |
| Escape speed | Grade 12 | v_esc = √(2GM / r) |

### Modern physics (5)

| Experiment | Level | Checked against |
|---|---|---|
| Photoelectric effect | Grade 12 | KE_max = h·f − φ |
| Threshold frequency | Grade 12 | No electrons when h·f < φ, however bright the light |
| Hydrogen spectrum | Grade 12 | 1/λ = R(1/n_f² − 1/n_i²) |
| Radioactive half-life | Grade 12 | N = N₀ · (½)^(t / T½) |
| Time dilation | University | Δt = γ·Δt₀,  γ = 1 / √(1 − v²/c²) |

## How the app is built

* `src/einstelab.html` is the whole app: one HTML file with its styles and scripts, no framework and no build step to run it. Open it in a browser to try it.
* `build-web.sh` minifies it into `android/assets/index.html`, the page both phone apps bundle.
* `android/` is a small WebView app (Java, built with the plain Android build tools, no Gradle). It also schedules the formula reminders at 07:00, 12:00 and 22:00 Tehran time.
* `ios/` is the same as a SwiftUI app. `project.yml` is an XcodeGen project, built unsigned on GitHub's macOS runners.
* `server/worker.js` is the key service, a Cloudflare Worker with a KV namespace bound as `KEYS`. Each access key works once: the first phone that uses it gets 3 days by the server's clock.
* `.github/workflows/einstelab-apk.yml` builds the web app, the APK and the IPA on every change under `einstelab/`. It publishes them as the `einstelab-latest` release.

### Inside `src/einstelab.html`

* **Bodies and contacts**: rigid bodies made of collision circles, impulse contacts with restitution and Coulomb friction, plus static segments for ramps and tank walls.
* **Fields**: magnets use the magnetic-pole (Gilbert) model, iron magnetises in the local field, and charges follow Coulomb's law. Field lines are traced with a midpoint integrator.
* **Instruments**: each instrument is a self-contained simulation registered in `APP` (`init`, `step`, `draw`, `stats`, `tap`): gas, calorimeter, conduction bar, orbit, string, photoelectric tube, atom, decay, light clock, Venturi pipe, jar, launcher and coil.
* **Experiments**: each entry in `EXL` has `set` (build the scene), optional `sub` and `frame` hooks (measure), and `chk` (rows of formula against model). A row passes within a stated tolerance.
* **Language**: every visible string goes through `T()`. Farsi runs right to left in Vazirmatn; formulas and measurements stay in English digits.

## Building locally

```sh
bash einstelab/build-web.sh          # needs Node.js
bash einstelab/android/build.sh      # needs the Android SDK (ANDROID_HOME) and a JDK
cd einstelab/ios && cp ../android/assets/index.html Resources/ && xcodegen generate   # on a Mac
```
