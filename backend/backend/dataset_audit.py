import os
import glob
import pandas as pd

project_root = r"C:\Users\magzt\Downloads\revenue-engine"
csv_files = glob.glob(os.path.join(project_root, "**", "*.csv"), recursive=True)
xlsx_files = glob.glob(os.path.join(project_root, "**", "*.xlsx"), recursive=True)

print("=== DATASET INVENTORY AUDIT ===")

dataset_info = []

for filepath in csv_files + xlsx_files:
    if "node_modules" in filepath or ".venv" in filepath or ".git" in filepath:
        continue
    rel_path = os.path.relpath(filepath, project_root)
    file_size_kb = round(os.path.getsize(filepath) / 1024, 2)
    try:
        if filepath.endswith(".csv"):
            df = pd.read_csv(filepath, nrows=50000)
        else:
            df = pd.read_excel(filepath, nrows=50000)
        num_rows = len(df)
        cols = list(df.columns)
        dataset_info.append({
            "rel_path": rel_path,
            "size_kb": file_size_kb,
            "rows": num_rows,
            "cols_count": len(cols),
            "sample_cols": ", ".join(cols[:5])
        })
    except Exception as e:
        dataset_info.append({
            "rel_path": rel_path,
            "size_kb": file_size_kb,
            "rows": "ERROR",
            "cols_count": 0,
            "sample_cols": str(e)
        })

df_report = pd.DataFrame(dataset_info)
print(df_report.to_string())

out_file = os.path.join(project_root, "backend", "backend", "dataset_audit_report.txt")
with open(out_file, "w", encoding="utf-8") as f:
    f.write("=== DATASET INVENTORY REPORT ===\n\n")
    for item in dataset_info:
        f.write(f"File: {item['rel_path']}\n")
        f.write(f"  Size: {item['size_kb']} KB | Rows: {item['rows']} | Cols: {item['cols_count']}\n")
        f.write(f"  Sample Columns: {item['sample_cols']}\n\n")
print(f"\nWrote dataset report to {out_file}")
