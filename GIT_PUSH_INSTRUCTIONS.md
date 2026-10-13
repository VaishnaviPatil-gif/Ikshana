# 🚀 Git Push Instructions for AegisOcean

This folder (`oil-spill-ready-to-push`) is completely isolated and prepared for Git. All unnecessary large files, build artifacts, caches, and secret keys have been excluded.

Follow these simple steps in your terminal to initialize and push this repository to GitHub or GitLab:

---

## 📌 Step 1: Open Terminal in this Folder

Open **PowerShell** or **Git Bash** and navigate to this folder:

```bash
cd "C:\Users\Temporary User\Desktop\oil-spill-ready-to-push"
```

---

## 📌 Step 2: Initialize Git Repository

Initialize the local repository and check the staged files:

```bash
# Initialize git
git init

# Set the default branch name to main
git branch -M main

# Add all files (respects .gitignore)
git add .

# Verify the staged files
git status
```

*(You will notice that all code, out-of-the-box GeoJSONs, demo assets, and the model weights are added, while `node_modules`, `venv`, `.env`, and raw gigabyte datasets are cleanly excluded!)*

---

## 📌 Step 3: Create Initial Commit

```bash
git commit -m "feat: initial commit of AegisOcean oil spill detection and vessel attribution platform"
```

---

## 📌 Step 4: Link Your Remote Repository

1. Go to [GitHub.com](https://github.com) and click **New Repository**.
2. Name your repository (e.g., `aegis-ocean` or `oil-spill-detection`).
3. Set visibility to **Public** or **Private**.
4. **Do not** check "Add a README file" or "Add .gitignore" (we already have them!).
5. Copy the repository URL (HTTPS or SSH) and run:

```bash
# Replace with your actual GitHub repository URL:
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
```

---

## 📌 Step 5: Push to GitHub

Push your project to GitHub:

```bash
git push -u origin main
```

---

## 👥 How Teammates Clone & Get Started

Send this quick command to your teammates:

```bash
# 1. Clone the project
git clone https://github.com/<your-username>/<your-repo-name>.git
cd <your-repo-name>

# 2. Run with Docker Compose (PostGIS + Redis + FastAPI + React)
docker compose up --build -d

# 3. Seed demo accounts, spills, and AIS tracks
docker compose exec backend python -m scripts.seed_demo_data

# 4. Open in browser:
# Frontend: http://localhost:5173
# Backend API & Docs: http://localhost:8000/docs
```