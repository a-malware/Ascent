import subprocess
import os
import time
import requests

def main():
    base_dir = r"c:\Users\zyrus\OneDrive\Documents\anything\backend"
    
    # Configure Node 1
    env1 = os.environ.copy()
    env1["NODE_PORT"] = "5000"
    env1["PEERS"] = "http://localhost:5001"
    env1["DATA_DIR"] = os.path.join(base_dir, "data_5000")
    
    # Configure Node 2
    env2 = os.environ.copy()
    env2["NODE_PORT"] = "5001"
    env2["PEERS"] = "http://localhost:5000"
    env2["DATA_DIR"] = os.path.join(base_dir, "data_5001")
    
    print("Starting nodes...")
    p1 = subprocess.Popen(["python", "main.py"], cwd=base_dir, env=env1)
    p2 = subprocess.Popen(["python", "main.py"], cwd=base_dir, env=env2)
    
    try:
        time.sleep(5) # wait for nodes to boot
        print("\n--- Node 1 Peers ---")
        try:
            r1 = requests.get("http://localhost:5000/peers", timeout=2)
            print(r1.json())
        except Exception as e:
            print("Failed to contact Node 1:", e)
            
        print("\n--- Node 2 Peers ---")
        try:
            r2 = requests.get("http://localhost:5001/peers", timeout=2)
            print(r2.json())
        except Exception as e:
            print("Failed to contact Node 2:", e)
            
        print("\n--- P2P Verification Complete ---")
    finally:
        print("Terminating nodes...")
        p1.terminate()
        p2.terminate()
        p1.wait()
        p2.wait()

if __name__ == "__main__":
    main()
