# ⚽ Ultimate Football Draft Simulator

**[🔴 Play the Live App Here](https://ultimate-football-draft.vercel.app)**

A statistical simulation engine built on a PostgreSQL relational database managing thousands of historical player records — with a Next.js dashboard as the visualization layer which allows users to draft a football squad from historical datasets and simulate full 38-game seasons or Champions League knockout brackets against AI opponents. 

Built with a focus on relational data management, probabilistic modeling, and state-driven UI.

## 🛠 Tech Stack
* **Frontend:** Next.js, React, Tailwind CSS
* **Backend/Database:** Supabase (PostgreSQL)
* **Deployment:** Vercel

## 📊 Technical Features
* **Relational Data Pipeline:** Integrates a Supabase PostgreSQL backend to fetch, filter, and manage complex datasets of historical player statistics and club attributes.
* **Statistical Match Engine:** Utilizes deterministic algorithms, weighted probabilities, and variance modifiers to calculate realistic match outcomes based on overall rating (OVR) differentials.
* **Dynamic Performance Modeling:** Applies statistical distributions to calculate individual player performance, dynamically generating end-of-season awards (MVP, Golden Boot) weighted by positional constraints.
* **Complex State Management:** Enforces authentic draft rules and real-time roster validation using advanced React hooks.

## 🚀 Running Locally
To run this project on your local machine:

1. Clone the repository:
   ```bash
   git clone [https://github.com/akshatkeshri/Ultimate-Football-Draft.git](https://github.com/akshatkeshri/Ultimate-Football-Draft.git)
