import axios from "axios"; axios.get("http://localhost:8080/api/marketplace").catch(e => console.log(e.response?.data))
