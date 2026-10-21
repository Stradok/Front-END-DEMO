# Gyraq demo

The Gyraq website plus two working products, loaded with made-up sample data, for showing to businesses.

| Open this | What it is |
|---|---|
| `/` | Gyraq website |
| `/products/crm/hvac` | **HVAC CRM**: jobs, dispatch, customers, estimates, invoices, AI agents. Sample company "Northwind Heating & Air" |
| `/products/erp/distribution` | **ERP for distributors**: sales, inventory, warehouses, purchasing, finance. Sample company "Meridian Distribution" |

No login and no password are needed. Every customer, job and order is fake.

## Running it

### Option 1: the website link (easiest)
Open the link you were given (the deployed address of this folder) in Chrome. Nothing to install.

### Option 2: on your own laptop
Use this if there is no website link yet, or as a backup.

1. Install **Node.js** (LTS) from https://nodejs.org (one time only).
2. Open a terminal in this folder and run:
   ```
   npx serve@14 -l 3000 .
   ```
   The first time, it asks to install `serve`; type `y`.
3. Open **http://localhost:3000** in Chrome. Keep the terminal open during the demo, and press `Ctrl+C` in it to stop.

You need an internet connection for the maps and fonts. Everything else runs on the laptop.

## During a demo
- **Switching roles.** The HVAC CRM starts as the owner. Pick another role (dispatcher, technician, customer) from the name at the bottom of the left menu. In the ERP, switch person from the name at the top right.
- **Making changes.** Clients can add, edit and delete anything. Changes stay only in that browser, and nobody else sees them.
- **Starting fresh before the next meeting.** In the HVAC CRM, press **Reset demo** in the purple banner. To reset everything, open a new private/incognito window.
- **Showing it on a phone.** In the HVAC CRM, open **Tech App** (technician screen) or **Customer Portal** on a phone, or make the browser window narrow.

## What to tell clients
- Some AI agents are **pre-recorded** in this demo: call answering (Ava), dispatch suggestions (Atlas) and follow-ups (Echo). Say: "these are recorded for the demo and run live in the Pro and Premium plans."
- The **chat assistant and the "ask the AI" buttons don't answer here**, because this demo has no server behind it. To show the live AI, book the full demo with the team.
- The numbers, names and dates are sample data. Never type a client's real customer details into it.

## Something not working?
- A page is blank or stuck: refresh the page.
- It shows old or odd data: open a private/incognito window.
- Still broken: use the public demo at https://www.gyraq.com/products/crm/hvac.

---

### For the developer
`./build.sh` rebuilds this folder from `../Gyraq`, `../HVAC-AI/Front-End` and `../ERP/frontend` (it never changes those repos). Deploy the folder to Vercel: `vercel.json` sends record links such as `/customers/<id>` to their page. `serve.json` holds the same rules for running it locally.
# Front-END-DEMO
