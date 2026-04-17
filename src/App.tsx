import { DataProvider } from './context/DataContext';
import { AppShell } from './components/shell/AppShell';

function App() {
  return (
    <DataProvider>
      <AppShell />
    </DataProvider>
  );
}

export default App;
