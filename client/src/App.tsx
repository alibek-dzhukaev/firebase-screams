import './App.css';
import {BrowserRouter as Router, Route} from 'react-router-dom'
import {routes} from "./util/routes";
import Home from "./pages/home";
import Login from "./pages/login";
import Signup from "./pages/signup";
import Navbar from "./components/Navbar";

function App() {
  return (
    <div className="App">
        <Navbar/>
      <Router>
          <Route exact path={routes.home} component={Home}/>
          <Route exact path={routes.login} component={Login}/>
          <Route exact path={routes.signup} component={Signup}/>
      </Router>
    </div>
  );
}

export default App;
