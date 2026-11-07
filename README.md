# ECG Lab

ECG simulator for ICU teaching and FCPS preparation: 77 live 12-lead ECGs with rate and severity sliders, "Show me" annotations, caliper, monitor view with arterial line and SpO₂, MCQ bank, OSPE practice, look-alike comparison, progress tracking, and ACLS / ICU drills (arrest, bradycardia, tachycardia, hyperkalaemia, pacing wires, torsades, toxicology, post-ROSC).

It is a static Progressive Web App: no build step, no server code. It works offline after the first visit and can be installed on a phone's home screen.

## Publish on GitHub Pages

1. Create a new repository (for example `ecg-lab`).
2. Upload **all files in this folder** to the root of the repository (keep the `icons` folder).
3. Repository **Settings → Pages → Build and deployment → Source: Deploy from a branch**, branch `main`, folder `/ (root)`, Save.
4. After a minute the app is live at `https://<your-username>.github.io/ecg-lab/`.

## Install on a phone

- **iPhone (Safari):** open the link → Share → *Add to Home Screen*.
- **Android (Chrome):** open the link → menu ⋮ → *Install app* / *Add to Home screen*.

## Updating

Replace the changed files in the repository. Then edit the `VERSION` line at the top of `sw.js` (any new text) so phones download the new version. The app shows an "Update available" button when it finds one.

## Notes

- Progress, flags and settings are stored on each device (browser storage). They are not shared between devices yet; a Firebase login can be added later.
- Synthetic teaching traces only: not for diagnosis or patient care.
