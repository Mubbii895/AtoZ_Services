const { useMemo, useReducer } = React;

const initialState = {
  isLoggedIn: false,
  userEmail: "",
  learners: [],
  selectedLearnerIds: [],
  loginEmailInput: "",
  learnerNameInput: "",
  searchInput: "",
  sortDirection: "asc",
  pageSize: 10,
  currentPage: 1,
};

function appReducer(state, action) {
  switch (action.type) {
    case "SET_LOGIN_EMAIL_INPUT":
      return { ...state, loginEmailInput: action.payload };

    case "LOGIN":
      return {
        ...state,
        isLoggedIn: true,
        userEmail: state.loginEmailInput.trim(),
        loginEmailInput: "",
      };

    case "SET_LEARNER_NAME_INPUT":
      return { ...state, learnerNameInput: action.payload };

    case "ADD_LEARNER": {
      const trimmedName = state.learnerNameInput.trim();
      if (!trimmedName) {
        return state;
      }

      const newLearner = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        name: trimmedName,
      };

      return {
        ...state,
        learners: [...state.learners, newLearner],
        learnerNameInput: "",
      };
    }

    case "DELETE_LEARNER": {
      const learnerId = action.payload;
      return {
        ...state,
        learners: state.learners.filter((learner) => learner.id !== learnerId),
        selectedLearnerIds: state.selectedLearnerIds.filter((id) => id !== learnerId),
      };
    }

    case "TOGGLE_LEARNER_SELECTION": {
      const learnerId = action.payload;
      const isSelected = state.selectedLearnerIds.includes(learnerId);
      return {
        ...state,
        selectedLearnerIds: isSelected
          ? state.selectedLearnerIds.filter((id) => id !== learnerId)
          : [...state.selectedLearnerIds, learnerId],
      };
    }

    case "TOGGLE_SELECT_VISIBLE": {
      const visibleLearnerIds = action.payload;
      if (!visibleLearnerIds.length) {
        return state;
      }

      const visibleSet = new Set(visibleLearnerIds);
      const selectedSet = new Set(state.selectedLearnerIds);
      const allVisibleSelected = visibleLearnerIds.every((id) => selectedSet.has(id));

      if (allVisibleSelected) {
        return {
          ...state,
          selectedLearnerIds: state.selectedLearnerIds.filter((id) => !visibleSet.has(id)),
        };
      }

      visibleLearnerIds.forEach((id) => selectedSet.add(id));
      return {
        ...state,
        selectedLearnerIds: Array.from(selectedSet),
      };
    }

    case "SET_SEARCH_INPUT":
      return {
        ...state,
        searchInput: action.payload,
        currentPage: 1,
      };

    case "TOGGLE_SORT_DIRECTION":
      return {
        ...state,
        sortDirection: state.sortDirection === "asc" ? "desc" : "asc",
        currentPage: 1,
      };

    case "SET_PAGE_SIZE":
      return {
        ...state,
        pageSize: Number(action.payload),
        currentPage: 1,
      };

    case "GO_TO_PREVIOUS_PAGE":
      return {
        ...state,
        currentPage: Math.max(1, state.currentPage - 1),
      };

    case "GO_TO_NEXT_PAGE":
      return {
        ...state,
        currentPage: action.payload,
      };

    default:
      return state;
  }
}

function LoginPage({ email, onEmailChange, onLogin }) {
  return (
    <div className="app-shell login-shell">
      <div className="card login-card">
        <h1 className="app-title">Language Learning App</h1>
        <p className="subtext">Enter your email to continue</p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            onLogin();
          }}
        >
          <label className="label" htmlFor="email-input">
            Email ID
          </label>
          <input
            id="email-input"
            type="text"
            className="input"
            placeholder="Enter your email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            required
          />
          <button type="submit" className="btn btn-primary full-width">
            Login
          </button>
        </form>
      </div>
    </div>
  );
}

function LearnerManagementPage({ state, dispatch, processedLearners }) {
  const {
    paginatedLearners,
    totalFiltered,
    totalPages,
    allVisibleSelected,
    hasLearners,
    currentPage,
    pageSize,
    searchInput,
    sortDirection,
    selectedLearnersCount,
    totalLearnersCount,
    visibleLearnerIds,
  } = processedLearners;

  return (
    <div className="app-shell">
      <div className="card app-card">
        <header className="header-row">
          <h2 className="management-title">SPEAK FREELY, CONNECT GLOBALLY</h2>
          <p className="logged-in-email">Logged in: {state.userEmail}</p>
        </header>

        <div className="top-actions">
          <input
            type="text"
            className="input"
            placeholder="Enter Learner's Name"
            value={state.learnerNameInput}
            onChange={(event) =>
              dispatch({ type: "SET_LEARNER_NAME_INPUT", payload: event.target.value })
            }
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                dispatch({ type: "ADD_LEARNER" });
              }
            }}
          />
          <button className="btn btn-primary" onClick={() => dispatch({ type: "ADD_LEARNER" })}>
            Add Learner
          </button>
          <button
            className="btn btn-success"
            onClick={() => {
              window.alert(`Start Learning with ${selectedLearnersCount} selected learner(s).`);
            }}
          >
            Start Learning
          </button>
        </div>

        <section className="stats-grid">
          <div className="stat-box">
            <span className="stat-label">Total Learners</span>
            <strong className="stat-value">{totalLearnersCount}</strong>
          </div>
          <div className="stat-box">
            <span className="stat-label">Selected Learners</span>
            <strong className="stat-value">{selectedLearnersCount}</strong>
          </div>
        </section>

        <section className="table-controls">
          <div className="control-item">
            <label htmlFor="page-size">Learners per page</label>
            <select
              id="page-size"
              className="select"
              value={pageSize}
              onChange={(event) =>
                dispatch({ type: "SET_PAGE_SIZE", payload: event.target.value })
              }
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="control-item grow">
            <label htmlFor="search-learners">Search learners</label>
            <input
              id="search-learners"
              type="text"
              className="input"
              value={searchInput}
              placeholder="Search by learner name"
              onChange={(event) =>
                dispatch({ type: "SET_SEARCH_INPUT", payload: event.target.value })
              }
            />
          </div>
        </section>

        <div className="table-wrap">
          <table className="learners-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allVisibleSelected && visibleLearnerIds.length > 0}
                    onChange={() =>
                      dispatch({
                        type: "TOGGLE_SELECT_VISIBLE",
                        payload: visibleLearnerIds,
                      })
                    }
                    aria-label="Select all visible learners"
                  />
                </th>
                <th>
                  <button
                    type="button"
                    className="sort-button"
                    onClick={() => dispatch({ type: "TOGGLE_SORT_DIRECTION" })}
                  >
                    Learner Name {sortDirection === "asc" ? "↑" : "↓"}
                  </button>
                </th>
                <th>Delete</th>
              </tr>
            </thead>
            <tbody>
              {!hasLearners ? (
                <tr>
                  <td colSpan={3} className="empty-row">
                    No learners added yet.
                  </td>
                </tr>
              ) : paginatedLearners.length === 0 ? (
                <tr>
                  <td colSpan={3} className="empty-row">
                    No learners match your search.
                  </td>
                </tr>
              ) : (
                paginatedLearners.map((learner) => {
                  const isSelected = state.selectedLearnerIds.includes(learner.id);
                  return (
                    <tr key={learner.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() =>
                            dispatch({
                              type: "TOGGLE_LEARNER_SELECTION",
                              payload: learner.id,
                            })
                          }
                          aria-label={`Select ${learner.name}`}
                        />
                      </td>
                      <td>{learner.name}</td>
                      <td>
                        <button
                          className="icon-button"
                          onClick={() =>
                            dispatch({
                              type: "DELETE_LEARNER",
                              payload: learner.id,
                            })
                          }
                          aria-label={`Delete ${learner.name}`}
                          title="Delete learner"
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <footer className="pagination-row">
          <span>
            Showing {paginatedLearners.length} of {totalFiltered} learner(s)
          </span>
          <div className="pagination-actions">
            <button
              className="btn btn-secondary"
              onClick={() => dispatch({ type: "GO_TO_PREVIOUS_PAGE" })}
              disabled={currentPage <= 1}
            >
              Previous
            </button>
            <span>
              Page {totalFiltered === 0 ? 0 : currentPage} / {totalPages}
            </span>
            <button
              className="btn btn-secondary"
              onClick={() => dispatch({ type: "GO_TO_NEXT_PAGE", payload: Math.min(totalPages, currentPage + 1) })}
              disabled={currentPage >= totalPages || totalFiltered === 0}
            >
              Next
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}

function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const processedLearners = useMemo(() => {
    const normalizedSearch = state.searchInput.trim().toLowerCase();

    const filteredLearners = state.learners.filter((learner) =>
      learner.name.toLowerCase().includes(normalizedSearch)
    );

    const sortedLearners = [...filteredLearners].sort((left, right) => {
      const comparison = left.name.localeCompare(right.name, undefined, {
        sensitivity: "base",
      });
      return state.sortDirection === "asc" ? comparison : comparison * -1;
    });

    const totalFiltered = sortedLearners.length;
    const pageSize = state.pageSize;
    const totalPages = Math.max(1, Math.ceil(totalFiltered / pageSize));
    const currentPage = Math.min(state.currentPage, totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedLearners = sortedLearners.slice(startIndex, endIndex);

    const visibleLearnerIds = paginatedLearners.map((learner) => learner.id);
    const selectedSet = new Set(state.selectedLearnerIds);
    const allVisibleSelected =
      visibleLearnerIds.length > 0 && visibleLearnerIds.every((id) => selectedSet.has(id));

    return {
      paginatedLearners,
      totalFiltered,
      totalPages,
      currentPage,
      pageSize,
      allVisibleSelected,
      visibleLearnerIds,
      hasLearners: state.learners.length > 0,
      searchInput: state.searchInput,
      sortDirection: state.sortDirection,
      selectedLearnersCount: state.selectedLearnerIds.length,
      totalLearnersCount: state.learners.length,
    };
  }, [state]);

  const isLoginEmailValid = state.loginEmailInput.trim().length > 0;

  return state.isLoggedIn ? (
    <LearnerManagementPage
      state={state}
      dispatch={dispatch}
      processedLearners={processedLearners}
    />
  ) : (
    <LoginPage
      email={state.loginEmailInput}
      onEmailChange={(value) => dispatch({ type: "SET_LOGIN_EMAIL_INPUT", payload: value })}
      onLogin={() => {
        if (isLoginEmailValid) {
          dispatch({ type: "LOGIN" });
        }
      }}
    />
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />);
