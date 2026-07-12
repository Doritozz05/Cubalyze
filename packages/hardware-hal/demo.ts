import { GanCubeAdapter } from './src/bluetooth/GanCubeAdapter';

const btnConnect = document.getElementById('btnConnect') as HTMLButtonElement;
const divStatus = document.getElementById('status') as HTMLDivElement;
const preMoves = document.getElementById('moves') as HTMLPreElement;
const divBattery = document.getElementById('battery') as HTMLDivElement;

const adapter = new GanCubeAdapter();

btnConnect.addEventListener('click', async () => {
  try {
    btnConnect.disabled = true;
    divStatus.textContent = 'Conectando...';
    
    await adapter.connect();
    
    divStatus.textContent = 'Conectado a ' + adapter.vendor + ' ' + adapter.model;
    
    adapter.moves$.subscribe(move => {
      preMoves.textContent = move.face + ' ' + preMoves.textContent;
    });
    
    adapter.battery$.subscribe(level => {
      divBattery.textContent = level + '%';
    });
    
  } catch (err: any) {
    divStatus.textContent = 'Error: ' + err.message;
    btnConnect.disabled = false;
  }
});
