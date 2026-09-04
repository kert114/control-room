# control-room

## KYC UI direction prototype (throwaway)

This branch (`prototype/ui-directions`) holds a disposable Next.js + Tailwind prototype used to
choose an information hierarchy for reviewing a risky KYC case. It uses synthetic in-memory data,
no database, no authentication, and no API.

### Run

```bash
npm install
npm run dev
# http://localhost:3000/prototype/kyc?variant=A
```

### URL parameters

| Parameter | Values |
| --- | --- |
| `variant` | `A` (operations workstation), `B` (risk dossier), `C` (command center) |
| `state` | `default`, `loading`, `empty`, `validation`, `forbidden`, `completed` |
| `role` | `operator`, `approver`, `auditor` |
| `case` | any synthetic case id, e.g. `KYC-4821` |

All parameters are preserved when switching variants.

### Keyboard

- `←` / `→` switch variant
- `↑` / `↓` move between cases (Variant C)
- `A` approve, `R` reject, `I` request information, `S` reassign
- `Esc` closes the active dialog or inspector

Shortcuts are ignored while an input, textarea, select, button, or contenteditable element has
focus, and when Meta, Control, or Alt is held.

### Files

- `app/prototype/kyc/page.tsx` — the single route
- `lib/prototype/model.ts` — canonical `KycPrototypeModel` (state, URL sync, stub actions)
- `lib/prototype/data.ts` — synthetic cases
- `components/prototype/shell.tsx` — variant switcher, scenario/role controls, shared atoms
- `components/prototype/dialogs.tsx` — action dialogs and the permission-denied state
- `components/prototype/variant-a|b|c.tsx` — one component per variant
