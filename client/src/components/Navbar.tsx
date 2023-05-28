import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Button from "@mui/material/Button";


const Navbar = () => {
    return (
        <AppBar>
            <Toolbar>
                <Button color='inherit'>Login</Button>
                <Button color='inherit'>Home</Button>
                <Button color='inherit'>Signup</Button>
            </Toolbar>
        </AppBar>
    );
};

export default Navbar;