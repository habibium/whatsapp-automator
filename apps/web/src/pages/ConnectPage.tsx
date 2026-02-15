import { useEffect } from "react";
import { useWhatsApp } from "../hooks/useWhatsApp";
import "./ConnectPage.css";

export function ConnectPage() {
  const { status, qrCode, loading, connect, disconnect } = useWhatsApp();

  useEffect(() => {
    if (status !== "connected" && !loading) {
      connect();
    }
  }, [status, loading, connect]);

  return (
    <div className="connect-page animate-fade-in">
      <header className="page-header">
        <h1 className="page-title">WhatsApp Connection</h1>
        <p className="page-subtitle">Link your WhatsApp account to send scheduled messages</p>
      </header>

      <div className="connect-card">
        {status === "connected" ? (
          <div className="connect-status connected">
            <div className="status-icon">✅</div>
            <h2 className="status-title">Connected</h2>
            <p className="status-description">
              Your WhatsApp account is connected and ready to send messages.
            </p>
            <button
              type="button"
              onClick={disconnect}
              className="btn btn-danger"
              disabled={loading}
            >
              Disconnect
            </button>
          </div>
        ) : status === "awaiting_qr" && qrCode ? (
          <div className="connect-qr">
            <div className="qr-container">
              <img src={qrCode} alt="WhatsApp QR Code" className="qr-image" />
            </div>
            <h2 className="qr-title">Scan QR Code</h2>
            <p className="qr-instructions">
              Open WhatsApp on your phone, go to{" "}
              <strong>Settings → Linked Devices → Link a Device</strong>, and scan this QR code.
            </p>
          </div>
        ) : (
          <div className="connect-loading">
            <div className="spinner spinner-lg" />
            <h2 className="loading-title">
              {status === "connecting" ? "Connecting..." : "Loading..."}
            </h2>
            <p className="loading-description">Please wait while we establish the connection.</p>
          </div>
        )}
      </div>

      <div className="connect-help">
        <h3 className="help-title">Need help?</h3>
        <ul className="help-list">
          <li>Make sure your phone has an active internet connection</li>
          <li>Keep WhatsApp open on your phone during the scan</li>
          <li>If the QR code expires, the page will automatically refresh</li>
          <li>Your session will remain active until you manually disconnect</li>
        </ul>
      </div>
    </div>
  );
}
