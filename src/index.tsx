import { createRoot } from 'react-dom/client';
import App from './app/App';
import './styles/main.scss';


const root = createRoot(document.getElementById('app')!);

let render = () => {
  root.render(<App />);
};

render();

if (module.hot) {
  // Support hot reloading of components
  // and display an overlay for runtime errors
  const renderApp = render;
  const renderError = (error: any) => {
    root.unmount();
    root.render(<div>{error}</div>);

    return;
  };

  render = () => {
    try {
      renderApp();
    } catch (error) {
      renderError(error);
    }
  };

  module.hot.accept('./app/App', () => {
    setTimeout(render);
  });
}
