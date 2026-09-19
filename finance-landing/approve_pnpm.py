import subprocess
import time

def main():
    print("Starting pnpm approve-builds interaction...")
    # Use pexpect-like behavior with stdin/stdout
    proc = subprocess.Popen(
        ['pnpm', 'approve-builds'],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )
    
    # Read output and reply
    time.sleep(2)
    # Write 'a' to select all, then '\n'
    print("Sending 'a\\n' to select all...")
    proc.stdin.write('a\n')
    proc.stdin.flush()
    
    time.sleep(2)
    # Write 'y' to approve, then '\n'
    print("Sending 'y\\n' to approve...")
    proc.stdin.write('y\n')
    proc.stdin.flush()
    
    # Print the rest of the output
    stdout, _ = proc.communicate()
    print("--- Output from pnpm ---")
    print(stdout)
    print("------------------------")
    print("Process finished with exit code:", proc.returncode)

if __name__ == '__main__':
    main()
