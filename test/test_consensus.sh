#!/bin/bash
set -e

echo "==========================================="
echo "  5-Node Consensus & Parallel Upload Test  "
echo "==========================================="

echo "1. Cleaning up existing instances and databases..."
killall node 2>/dev/null || true
for port in 26780 26781 26782 26783 26784; do
    mongo secure_storage_db_$port --eval "db.dropDatabase()" > /dev/null 2>&1 || true
done

echo "2. Starting 5 peer nodes..."
./start.sh --port 26780 --public-address 127.0.0.1:26780 > /dev/null 2>&1
sleep 2
./start.sh --port 26781 --discover 127.0.0.1:26780 --public-address 127.0.0.1:26781 > /dev/null 2>&1
./start.sh --port 26782 --discover 127.0.0.1:26780,127.0.0.1:26781 --public-address 127.0.0.1:26782 > /dev/null 2>&1
./start.sh --port 26783 --discover 127.0.0.1:26780,127.0.0.1:26781,127.0.0.1:26782 --public-address 127.0.0.1:26783 > /dev/null 2>&1
./start.sh --port 26784 --discover 127.0.0.1:26780,127.0.0.1:26781,127.0.0.1:26782,127.0.0.1:26783 --public-address 127.0.0.1:26784 > /dev/null 2>&1

echo "Waiting for network convergence (10 seconds)..."
sleep 10

echo "3. Creating test files..."
echo "Sequential 1" > dummy1.txt
echo "Sequential 2" > dummy2.txt
echo "Parallel A" > dummy3.txt
echo "Parallel B" > dummy4.txt

echo "4. Sequential Upload 1 (Target: Node 26780)..."
curl -s -k -X POST -F 'files=@dummy1.txt' https://127.0.0.1:26780/api/upload
echo -e "\n"

echo "5. Sequential Upload 2 (Target: Node 26781)..."
curl -s -k -X POST -F 'files=@dummy2.txt' https://127.0.0.1:26781/api/upload
echo -e "\n"

echo "6. Parallel Uploads (Targets: Node 26782 and Node 26783)..."
curl -s -k -X POST -F 'files=@dummy3.txt' https://127.0.0.1:26782/api/upload > res3.json &
PID1=$!
curl -s -k -X POST -F 'files=@dummy4.txt' https://127.0.0.1:26783/api/upload > res4.json &
PID2=$!

wait $PID1
wait $PID2

echo "Parallel uploads completed. Results:"
cat res3.json
echo ""
cat res4.json
echo -e "\n"

echo "Waiting 5 seconds for full network settling..."
sleep 5

echo "7. Validating Chain Consensus..."
for port in 26780 26781 26782 26783 26784; do
    curl -s -k "https://127.0.0.1:$port/api/blocks" | node -e "
try {
    const res = JSON.parse(require('fs').readFileSync(0, 'utf-8'));
    if (!res.blocks) throw new Error('No blocks field');
    // Ensure consistent ordering for parallel blocks sharing the same index
    const hashes = res.blocks.map(b => b.hash).sort().join(',');
    console.log(hashes);
} catch(e) {
    console.error('ERROR parsing response from $port', e.message);
}
" > chain_$port.txt
done

# Check if all files are identical
if cmp -s chain_26780.txt chain_26781.txt && \
   cmp -s chain_26780.txt chain_26782.txt && \
   cmp -s chain_26780.txt chain_26783.txt && \
   cmp -s chain_26780.txt chain_26784.txt; then
    echo "==========================================="
    echo "✅ SUCCESS: Consensus achieved across all 5 nodes!"
    echo "Final Chain Hashes (from first to last returned):"
    cat chain_26780.txt | tr ',' '\n' | awk '{print " - "$1}'
    echo "==========================================="
else
    echo "❌ FAILURE: Divergence detected in chains!"
    md5 chain_*.txt 2>/dev/null || md5sum chain_*.txt 2>/dev/null
    echo "Dumping hashes:"
    for port in 26780 26781 26782 26783 26784; do
        echo "Node $port:"
        cat chain_$port.txt
    done
    exit 1
fi

echo "8. Cleaning up test files..."
rm dummy*.txt res*.json chain_*.txt
killall node 2>/dev/null || true
echo "Test Sequence Complete."
