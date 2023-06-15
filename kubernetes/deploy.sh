#kubectl apply -f ./ai-arena-budget-mode.yaml
#sleep 5
nodeIp=$(kubectl get nodes -o wide | awk 'FNR==2 {print $7}')
curl -s "http://sync.afraid.org/u/zrWoeuP55kF5oVFnpfVqKtNg/?ip=$nodeIp"