# Attendance Analyser

A visual attendance tracker that shows your current standing and projects future trajectories based on whether you attend or skip upcoming lectures.

## Files

```
attendance-analyser/
├── index.html   — Structure and markup only
├── style.css    — All styles, theming, layout
├── app.js       — All logic: formulas, charts, animations
└── README.md    — This file
```

## How to Run

Just open `index.html` in a browser. No build step, no dependencies to install — everything is loaded from CDNs.

## How It Works

### Inputs (Left Panel)

| Field | Variable | Description |
|-------|----------|-------------|
| Attended so far | `x` | Lectures attended before the absence |
| Missed in a row | `n` | Consecutive lectures missed |
| Attended since return | `k` | Lectures attended after coming back |

### Derived Values

```
attended = x + k
total    = x + n + k
att%     = attended / total × 100
```

### Skip Budget (when att ≥ 75%)

```
canSkip = floor(attended / 0.75 − total)
```
You need `attended ≥ 0.75 × total`. Total can grow by `attended/0.75 − total` before you drop below the threshold.

### Recovery Target (when att < 75%)

```
need = ceil((0.75 × total − attended) / 0.25)
```
Each lecture you attend adds 1 to attended and 1 to total. Net gain per lecture = `1 − 0.75 = 0.25`.

### Rate of Rise (R)

```
R = (n × k) / (total × (x + n)) × 100
```
Measures how much attendance has recovered per lecture attended post-absence. Weighted by absence severity (`n`) and normalised to the damage point (`x + n`).

### Rate of Fall (F)

```
F = −(n) / (x + n) × 100
```
Measures the total attendance drop caused by the absence streak. This is a fixed measure — it captures how badly the streak hurt you from the peak.

## Making Changes

### Change the projection window
In `app.js`, line near the top:
```js
const PROJ = 30; // change to any number of lectures to project ahead
```

### Change the attendance threshold (default 75%)
Search for `0.75` and `75` in `app.js` — replace all with your desired threshold (e.g. `0.66` / `66`).

### Change colours
Edit the CSS variables in `style.css` under `[data-theme="dark"]` or `[data-theme="light"]`.

### Add a new input field
1. Add the HTML input group in `index.html` (copy an existing `.inp-group`)
2. Read the value in the `update()` function in `app.js`
3. Use it in the formulas as needed

## Dependencies (loaded via CDN)

- [Chart.js 4.4.1](https://www.chartjs.org/) — trajectory chart + mini sparklines
- [Anime.js 3.2.1](https://animejs.com/) — all animations and transitions
- [DM Serif Display + Plus Jakarta Sans](https://fonts.google.com/) — typography
