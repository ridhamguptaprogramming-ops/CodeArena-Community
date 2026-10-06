import { Router, Route } from '@solidjs/router';
import { onMount } from 'solid-js';
import { inject } from '@vercel/analytics';
import Landing from '../pages/Landing';
import Editor from '../pages/Editor';
import Visualizer from '../visualization/Visualizer';
import About from '../pages/About';
import Features from '../pages/Features';
import Docs from '../pages/Docs';

import { storageService } from '../services/storage.service';

const App = () => {
    onMount(() => {
        const theme = storageService.getUiTheme();
        document.documentElement.setAttribute('data-theme', theme);
        
        // Initialize Vercel Web Analytics
        inject();
    });

    return (
        <Router>
            <Route path="/" component={Landing} />
            <Route path="/editor" component={Editor} />
            <Route path="/visualize" component={Visualizer} />
            <Route path="/about" component={About} />
            <Route path="/features" component={Features} />
            <Route path="/docs" component={Docs} />
        </Router>
    );
};

export default App;
