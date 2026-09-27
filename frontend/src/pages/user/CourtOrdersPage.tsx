import { useState } from "react";

type CourtOrdersPageProps = {
  onBack: () => void;
};

type CourtOrder = {
  id: number;
  title: string;
  caseNumber: string;
  court: string;
  date: string;
  type: string;
};

const courtOrders: CourtOrder[] = [
  {
    id: 1,
    title: "Order on Interim Application",
    caseNumber: "CNR/MH/2026/001245",
    court: "District Court, Pune",
    date: "18 September 2026",
    type: "Interim Order",
  },
  {
    id: 2,
    title: "Hearing Direction Order",
    caseNumber: "CNR/MH/2026/002781",
    court: "Civil Court, Pune",
    date: "12 September 2026",
    type: "Hearing Order",
  },
  {
    id: 3,
    title: "Final Judgment Order",
    caseNumber: "CNR/MH/2025/009821",
    court: "District Court, Pune",
    date: "05 September 2026",
    type: "Final Order",
  },
];

export default function CourtOrdersPage({
  onBack,
}: CourtOrdersPageProps) {
  const [search, setSearch] = useState("");
  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const filteredOrders = courtOrders.filter((order) =>
    `${order.title} ${order.caseNumber} ${order.court} ${order.type}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const handleFileChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
  };

  return (
    <main className="court-orders-page">

      {/* BACK TO DASHBOARD */}
      <div className="page-back-wrapper">
        <button
          type="button"
          className="page-back-button"
          onClick={onBack}
        >
          ← Back to Dashboard
        </button>
      </div>

      {/* HERO */}
      <section className="court-orders-hero">

        <div className="hero-badge">
          ⚖ NYAYMITRA COURT SERVICES
        </div>

        <h1>
          Find and understand
          <br />
          <span>your court orders</span>
        </h1>

        <p>
          Search your court orders, upload documents, and understand
          important legal decisions in simple language.
        </p>

        <div className="order-search-box">

          <div className="search-icon">
            🔍
          </div>

          <input
            type="text"
            placeholder="Search by case number, order title, court or order type..."
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
          />

        </div>

      </section>

      {/* MAIN CONTENT */}
      <section className="order-content">

        {/* UPLOAD */}
        <div className="upload-card">

          <div className="upload-icon">
            📄
          </div>

          <div className="upload-text">

            <h2>
              Explain a Court Order
            </h2>

            <p>
              Upload your court order and NyayMitra can help
              explain its important points in simpler language.
            </p>

            {selectedFile && (
              <div className="selected-file">
                Selected: {selectedFile.name}
              </div>
            )}

          </div>

          <label className="upload-button">
            Upload Order

            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={handleFileChange}
              hidden
            />
          </label>

        </div>

        {/* HEADING */}
        <div className="orders-heading">

          <div>
            <span className="section-label">
              YOUR DOCUMENTS
            </span>

            <h2>
              Recent Court Orders
            </h2>
          </div>

          <div className="order-count">
            {filteredOrders.length} Orders
          </div>

        </div>

        {/* ORDERS */}
        {filteredOrders.length > 0 ? (

          <div className="orders-grid">

            {filteredOrders.map((order) => (

              <article
                className="order-card"
                key={order.id}
              >

                <div className="order-card-top">

                  <div className="document-icon">
                    📄
                  </div>

                  <div className="available-badge">
                    Available
                  </div>

                </div>

                <div className="order-type">
                  {order.type}
                </div>

                <h3>
                  {order.title}
                </h3>

                <div className="order-details">

                  <div>
                    <span>Case Number</span>
                    <strong>
                      {order.caseNumber}
                    </strong>
                  </div>

                  <div>
                    <span>Court</span>
                    <strong>
                      {order.court}
                    </strong>
                  </div>

                  <div>
                    <span>Date</span>
                    <strong>
                      {order.date}
                    </strong>
                  </div>

                </div>

                <button
                  type="button"
                  className="explain-button"
                  onClick={() =>
                    alert(
                      `Court order explanation for ${order.caseNumber} will be available here.`
                    )
                  }
                >
                  <span>
                    Explain this order
                  </span>

                  <span>
                    →
                  </span>
                </button>

              </article>

            ))}

          </div>

        ) : (

          <div className="empty-orders">

            <div>🔍</div>

            <h3>
              No court orders found
            </h3>

            <p>
              Try searching with another case number,
              court name, or order type.
            </p>

          </div>

        )}

      </section>

    </main>
  );
}