import React, { useState, useEffect } from "react";
import axios from "axios";
import { FrappeApp } from "frappe-js-sdk";
import "./App.css";

function App() {
  // Setting API
  const getSiteName = () => {
    if (
      window.frappe?.boot?.versions?.frappe &&
      (window.frappe.boot.versions.frappe.startsWith("15") ||
        window.frappe.boot.versions.frappe.startsWith("16"))
    ) {
      return window.frappe?.boot?.sitename ?? import.meta.env.VITE_SITE_NAME;
    }
    return import.meta.env.VITE_SITE_NAME;
  };

  const frappeUrl = getSiteName();

  const frappe = new FrappeApp(frappeUrl);
  const db = frappe.db();
  const file = frappe.file();

  // Login Code

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const isLoggedIn = localStorage.getItem("isLoggedIn");
    if (isLoggedIn === "true") {
      document.querySelector("#login").style.display = "none";
      document.querySelector(".container").style.display = "block";
    }
  }, []);

  const handleLogin = async (e) => {
    try {
      const auth = frappe.auth();
      await auth.loginWithUsernamePassword({ username, password });

      localStorage.setItem("isLoggedIn", true);
      document.querySelector(".login").style.display = "none";
      document.querySelector(".container").style.display = "block";
    } catch (error) {}
  };

  // Fetch data for purchase order
  const [countitem, setCountItem] = useState(0);
  const [orderList, setOrderList] = useState([]);
  useEffect(() => {
    if (countitem === 0) {
      db.getDocList("Purchase Order")
        .then((doclist) => {
          const list = doclist.map((doc) => doc.name);
          setOrderList(list);
        })
        .catch((error) => console.error(error));
    }
    setCountItem(1);
  }, [countitem, db]);

  // Suggestions for purchase order
  const [selectedOrder, setSelectedOrder] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const handleInputChange = (e) => {
    const value = e.target.value;
    setSelectedOrder(value);
    const suggestions = orderList.filter((order) =>
      order.toLowerCase().includes(value.toLowerCase())
    );
    setSuggestions(suggestions);
  };

  const handleSuggestionClick = (suggestion) => {
    setSelectedOrder(suggestion);
    setSuggestions([]);
    document.querySelector(".orderdetails").style.display = "block";
  };

  const showsuggestions = () => {
    if (selectedOrder.trim() === "") {
      setSuggestions(orderList);
    } else {
      const filteredSuggestions = orderList.filter((order) =>
        order.toLowerCase().includes(selectedOrder.toLowerCase())
      );
      setSuggestions(filteredSuggestions);
    }
  };

  // Get data for single order
  const [countdetail, setcountdetail] = useState(0);
  const [singleOrder, setsingleOrder] = useState({ items: [] });
  useEffect(() => {
    if (selectedOrder !== "") {
      if (countdetail === 0) {
        db.getDoc("Purchase Order", selectedOrder)
          .then((doc) => {
            setsingleOrder(doc);
          })
          .catch((error) => {
            console.error("Error fetching data:", error);
          });
      }
      setcountdetail(1);
    }
  }, [db, selectedOrder]);

  // Create table rows for items
  const [isFileAttached, setIsFileAttached] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);

  // Function to handle file removal
  const handleRemoveFile = () => {
    setSelectedFile(null);
    setIsFileAttached(false);
  };

  // Function to handle file change
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
    setIsFileAttached(true);
  };

  // Conditional rendering for file input or remove button
  const renderFileInput = () => {
    return (
      <>
        <input
          type="file"
          placeholder="Choose"
          className="img"
          accept=".png, .jpg, .jpeg"
          style={{ display: isFileAttached ? "none" : "block" }} // Hide if file is attached
          onChange={(e) => handleFileChange(e)}
        />
        {isFileAttached && ( // Show only if file is attached
          <button className="remove" onClick={handleRemoveFile}>
            Remove
          </button>
        )}
      </>
    );
  };

  // Update the JSX for table row creation to render the file input or remove button
  const createTable = () => {
    return singleOrder.items.map((row, index) => (
      <tr key={index}>
        <td id={row.name} style={{ display: "none" }}>
          <h5 className="itemcode">{row.item_code}</h5>
        </td>
        <td id={row.item_name}>
          <h5 className="itemname">{row.item_name}</h5>
        </td>
        <td id={row.item_code}>
          <input
            type="number"
            min={1}
            style={{ width: "50px" }}
            className="num"
          />
        </td>
        <td id={row.idx}>{renderFileInput()}</td>
      </tr>
    ));
  };

  // Function to handle form submission
  const clickSubmit = () => {
    const tableRows = document.querySelectorAll(".orderdetails table tbody tr");
    const promises = []; // Array to store promises for each file upload
    const rowData = [];

    tableRows.forEach((row) => {
      const itemCode = row.querySelector(".itemcode").textContent;
      const quantity = parseFloat(row.querySelector(".num").value);
      const imageFile = row.querySelector(".img").files[0];

      if (imageFile) {
        // Check if imageFile exists
        const fileArgs = {
          isPrivate: true,
          folder: "Home",
          file_url: "",
          doctype: "User",
          docname: "Administrator",
          fieldname: "image",
        };

        // Push a promise returned by the file.uploadFile() call to the promises array
        promises.push(
          file
            .uploadFile(imageFile, fileArgs, (completedBytes, totalBytes) =>
              console.log(Math.round((completedBytes / totalBytes) * 100))
            )
            .then((result) => {
              rowData.push({
                item_code: itemCode,
                quantity_received_by_gatekeeper: quantity,
                item_image: result.data.message.file_url,
              });
            })
            .catch((e) => console.error(e))
        );
      }
    });

    Promise.all(promises)
      .then(() => {
        let ge_doc = {
          purchase_order: singleOrder.items[0].parent,
          items: rowData,
        };
        console.log(ge_doc);
        setTimeout(() => {
          console.log("Second block of code executed after 5 seconds");
          db.createDoc("Gatekeeper View", ge_doc)
            .then((doc) => console.log(doc))
            .catch((error) => console.error(error));
        }, 5000);
      })
      .catch((error) => console.error("Error uploading files:", error));
  };

  return (
    <>
      {/* login */}
      <div
        id="login"
        style={{
          height: "100vh",
          backgroundColor: "#f8f9fa",
          display: "block",
        }}
        className="login"
      >
        <div className="Contaner">
          <main
            className="form-signin"
            style={{
              maxWidth: "400px",
              padding: "20px",
              borderRadius: "10px",
              boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
            }}
          >
            <form>
              <h1 className="h1 mb-1 fw-center text-center">STOCK TRANSFER</h1>
              <h1 className="h3 mb-3 fw-normal text-center">Please sign in</h1>

              <div className="form-floating">
                <input
                  type="email"
                  className="form-control"
                  id="floatingInput"
                  placeholder="name@example.com"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  style={{ borderRadius: "10px" }}
                />
                <label htmlFor="floatingInput">Email address</label>
              </div>
              <div className="form-floating">
                <input
                  type="password"
                  className="form-control"
                  id="floatingPassword"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{ borderRadius: "10px" }}
                />
                <label htmlFor="floatingPassword">Password</label>
              </div>

              <div className="form-check text-start my-3">
                <input
                  className="form-check-input"
                  type="checkbox"
                  value="remember-me"
                  id="flexCheckDefault"
                />
                <label className="form-check-label" htmlFor="flexCheckDefault">
                  Remember me
                </label>
              </div>
              <button
                className="btn btn-primary w-100 py-2"
                type="button"
                onClick={handleLogin}
                style={{ borderRadius: "10px" }}
              >
                Sign in
              </button>
              <p className="mt-5 mb-3 text-body-secondary text-center">
                © 2023-2024
              </p>
            </form>
          </main>
        </div>
      </div>
      {/* main */}
      <div className="container">
        <div className="logo">
          <h1>Gatekeeper View</h1>
        </div>
        <div className="searchmenu">
          <input
            type="search"
            placeholder="Search for your Orders"
            className="purorder"
            value={selectedOrder}
            onChange={handleInputChange}
            onFocus={showsuggestions}
          />
          {suggestions.length > 0 && (
            <ul className="suggestions">
              {suggestions.map((suggestion, index) => (
                <li
                  key={index}
                  onClick={() => handleSuggestionClick(suggestion)}
                >
                  {suggestion}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="orderdetails">
          <div className="details">
            <table>
              <thead>
                <tr>
                  <th>Item Name</th>
                  <th>Quantity Received by Gatekeeper</th>
                  <th>Item Image</th>
                </tr>
              </thead>
              <tbody>{createTable()}</tbody>
            </table>
          </div>
          <button className="submit" onClick={clickSubmit}>
            Submit
          </button>
        </div>
      </div>
    </>
  );
}

export default App;
