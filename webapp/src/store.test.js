import { ActionsObservable } from "redux-observable"
import {
  configureStore,
  reducer,
  rootEpic,
  makeGetTasks,
  getTaskById,
  editTask,
  tasksReceived,
  reloadTasks,
  deleteTask,
  editNewTaskText,
  newTaskEpic,
  createNewTask,
  taskCreateFailed,
  taskCreated,
  clearNewTask,
  loadTasksEpic,
  tasksLoadingFailed,
  tasksLoadingStarted,
  loadNextTasks,
  editTaskEpic,
  taskEditFailed,
  taskEditSucceeded,
  deleteTaskEpic,
  taskDeleteFailed,
  taskDeleteSucceeded
} from "./store"
import { empty as emptyObservable } from "rxjs/observable/empty"
import { toArray } from "rxjs/operators"
import { getTempTaskId } from "./util"

describe("configureStore", () => {
  it("makes a store without a default state", () => {
    expect(configureStore({}).getState()).toBeTruthy()
  })
})

describe("selectors", () => {
  describe("getTaskById", () => {
    it("gets the task when it is there", () => {
      expect(
        getTaskById(
          {
            tasks: {
              items: {
                a: { _id: "a", isComplete: false, text: "foo" }
              }
            }
          },
          "a"
        )
      ).toEqual({ _id: "a", isComplete: false, text: "foo" })
    })

    it("returns undefined when there is no task", () => {
      expect(
        getTaskById(
          {
            tasks: {
              items: {}
            }
          },
          "a"
        )
      ).toBe(undefined)
    })
  })

  describe("getTasks", () => {
    const getTasks = makeGetTasks()

    it("gets a list from a loaded state in order", () => {
      const tempId = getTempTaskId()

      expect(
        getTasks({
          tasks: {
            items: {
              a3s5: { _id: "a3s5", isComplete: false, text: "foo" },
              [tempId]: { _id: tempId, isComplete: false, text: "baz" },
              "123s": { _id: "123s", isComplete: true, text: "bar" }
            }
          }
        })
      ).toEqual([
        { _id: tempId, isComplete: false, text: "baz" },
        { _id: "a3s5", isComplete: false, text: "foo" },
        { _id: "123s", isComplete: true, text: "bar" }
      ])
    })

    it("sorts temporary ids on top", () => {
      expect(
        getTasks({
          tasks: {
            items: {
              a: { _id: "a", isComplete: false, text: "foo" },
              b: { _id: "b", isComplete: true, text: "bar" }
            }
          }
        })
      ).toEqual([
        { _id: "b", isComplete: true, text: "bar" },
        { _id: "a", isComplete: false, text: "foo" }
      ])
    })

    it("gets an empty list from an empty loaded state", () => {
      expect(
        getTasks({
          tasks: {
            items: {}
          }
        })
      ).toEqual([])
    })
  })
})

describe("reducer", () => {
  const initialState = {
    newTask: { text: "" },
    tasks: { status: "UNLOADED", items: {} }
  }

  const stateWithTaskA = {
    ...initialState,
    tasks: {
      ...initialState.tasks,
      status: "LOADED",
      items: {
        a: { _id: "a", isComplete: false, text: "foo" }
      },
      nextPageToken: "abc"
    }
  }

  it("ignores unknown actions", () => {
    expect(reducer(initialState, { type: "UNKNOWN" })).toEqual(initialState)
  })

  it("adds items on load", () => {
    const itemA = { _id: "a", isComplete: false, text: "foo" }
    const itemB = { _id: "b", isComplete: true, text: "bar" }
    const pageToken1 = "abc"
    const pageToken2 = null
    const stateAfterPage1 = {
      ...initialState,
      tasks: {
        ...initialState.tasks,
        status: "LOADED",
        items: {
          a: itemA
        },
        nextPageToken: pageToken1
      }
    }
    const stateAfterPage2 = {
      ...stateAfterPage1,
      tasks: {
        ...stateAfterPage1.tasks,
        status: "LOADED",
        items: {
          a: itemA,
          b: itemB
        },
        nextPageToken: pageToken2
      }
    }

    expect(reducer(initialState, tasksReceived([itemA], pageToken1))).toEqual(
      stateAfterPage1
    )
    expect(
      reducer(stateAfterPage1, tasksReceived([itemB], pageToken2))
    ).toEqual(stateAfterPage2)
    expect(reducer(stateAfterPage2, tasksReceived([], pageToken2))).toEqual(
      stateAfterPage2
    )
  })

  it("removes all items on refresh", () => {
    expect(reducer(stateWithTaskA, reloadTasks())).toEqual({
      ...stateWithTaskA,
      tasks: {
        ...stateWithTaskA.tasks,
        items: {},
        nextPageToken: null
      }
    })
  })

  it("sets the status to loading once loading starts", () => {
    expect(reducer(stateWithTaskA, tasksLoadingStarted())).toEqual({
      ...stateWithTaskA,
      tasks: {
        ...stateWithTaskA.tasks,
        status: "LOADING"
      }
    })
  })

  it("indicates errors when loading tasks fails", () => {
    expect(reducer(stateWithTaskA, tasksLoadingFailed("foo error"))).toEqual({
      ...stateWithTaskA,
      tasks: {
        ...stateWithTaskA.tasks,
        status: "ERROR",
        lastErrorMessage: "foo error"
      }
    })
  })

  it("can edit the new task", () => {
    expect(
      reducer(
        {
          ...initialState,
          newTask: {
            ...initialState.newTask,
            text: "foo"
          }
        },
        editNewTaskText("bar")
      )
    ).toEqual({
      ...initialState,
      newTask: {
        ...initialState.newTask,
        text: "bar"
      }
    })
  })

  it("can edit tasks", () => {
    expect(
      reducer(stateWithTaskA, editTask("a", { isComplete: true }))
    ).toEqual({
      ...stateWithTaskA,
      tasks: {
        ...stateWithTaskA.tasks,
        items: {
          ...stateWithTaskA.tasks.items,
          a: { ...stateWithTaskA.tasks.items.a, isComplete: true }
        }
      }
    })
  })

  it("reverts back to the original when edit fails", () => {
    expect(
      reducer(stateWithTaskA, taskEditFailed("a", { isComplete: true }))
    ).toEqual({
      ...stateWithTaskA,
      tasks: {
        ...stateWithTaskA.tasks,
        items: {
          ...stateWithTaskA.tasks.items,
          a: { ...stateWithTaskA.tasks.items.a, isComplete: true }
        }
      }
    })
  })

  it("can delete tasks", () => {
    expect(reducer(stateWithTaskA, deleteTask("a"))).toEqual({
      ...stateWithTaskA,
      tasks: {
        ...stateWithTaskA.tasks,
        items: {}
      }
    })
  })

  it("puts a task back if it failed to delete", () => {
    expect(
      reducer(
        stateWithTaskA,
        taskDeleteFailed("b", { isComplete: true, text: "bar" })
      )
    ).toEqual({
      ...stateWithTaskA,
      tasks: {
        ...stateWithTaskA.tasks,
        items: {
          ...stateWithTaskA.tasks.items,
          b: { _id: "b", isComplete: true, text: "bar" }
        }
      }
    })
  })

  it("deletes a task if it failed to create on the server", () => {
    expect(reducer(stateWithTaskA, taskCreateFailed("a"))).toEqual({
      ...stateWithTaskA,
      tasks: {
        ...stateWithTaskA.tasks,
        items: {}
      }
    })
  })

  it("creates a dummy task with a temporary id while the server loads the real one", () => {
    expect(
      reducer(
        {
          ...initialState,
          newTask: { ...initialState.newTask, text: "foo" }
        },
        createNewTask("fooTempId")
      )
    ).toEqual({
      ...initialState,
      newTask: { ...initialState.newTask, text: "foo" },
      tasks: {
        ...initialState.tasks,
        items: {
          fooTempId: {
            _id: "fooTempId",
            isComplete: false,
            text: "foo"
          }
        }
      }
    })
  })

  it("does not create a dummy task when there is no new task text entered", () => {
    expect(
      reducer(
        {
          ...initialState,
          newTask: { ...initialState.newTask, text: "" }
        },
        createNewTask("fooTempId")
      )
    ).toEqual({
      ...initialState,
      newTask: { ...initialState.newTask, text: "" }
    })
  })

  it("creation replaces the temporary ID with the one from the server", () => {
    expect(reducer(stateWithTaskA, taskCreated("a", "abc"))).toEqual({
      ...stateWithTaskA,
      tasks: {
        ...stateWithTaskA.tasks,
        items: {
          abc: {
            ...stateWithTaskA.tasks.items.a,
            _id: "abc"
          }
        }
      }
    })
  })

  it("can clear out the newTask text", () => {
    expect(
      reducer(
        {
          ...initialState,
          newTask: {
            ...initialState.newTask,
            text: "foo"
          }
        },
        clearNewTask()
      )
    ).toEqual({
      ...initialState,
      newTask: {
        ...initialState.newTask,
        text: ""
      }
    })
  })
})

describe("epics", () => {
  describe("rootEpic", () => {
    it("ignores unknown actions", async () => {
      await expect(
        rootEpic(ActionsObservable.of({ type: "UNKNOWN" }), {}, {})
          .pipe(toArray())
          .toPromise()
      ).resolves.toEqual([])
    })
  })

  describe("newTaskEpic", () => {
    it("calls fetch when it gets a create action", async () => {
      const fetchFromAPI = jest.fn().mockReturnValue(Promise.resolve())

      await newTaskEpic(
        ActionsObservable.of(createNewTask()),
        { getState: () => ({ newTask: { text: "foo" } }) },
        { fetchFromAPI }
      ).toPromise()

      expect(fetchFromAPI).toBeCalledWith("/tasks", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          isComplete: false,
          text: "foo"
        })
      })
    })

    it("does nothing when it gets a create action without text", async () => {
      const fetchFromAPI = jest.fn().mockReturnValue(Promise.resolve())

      await expect(
        newTaskEpic(
          ActionsObservable.of(createNewTask()),
          { getState: () => ({ newTask: { text: "" } }) },
          { fetchFromAPI }
        )
          .pipe(toArray())
          .toPromise()
      ).resolves.toEqual([])

      expect(fetchFromAPI).not.toBeCalled()
    })

    it("handles fetch errors gracefully", async () => {
      await expect(
        newTaskEpic(
          ActionsObservable.of(createNewTask("abc")),
          { getState: () => ({ newTask: { text: "foo" } }) },
          { fetchFromAPI: () => Promise.reject(TypeError("Failed to fetch")) }
        )
          .pipe(toArray())
          .toPromise()
      ).resolves.toEqual([
        clearNewTask(),
        taskCreateFailed("abc", "Failed to fetch")
      ])
    })

    it("handles http errors gracefully", async () => {
      await expect(
        newTaskEpic(
          ActionsObservable.of(createNewTask("abc")),
          { getState: () => ({ newTask: { text: "foo" } }) },
          {
            fetchFromAPI: () =>
              Promise.resolve({
                ok: false,
                status: 500,
                statusText: "Server error"
              })
          }
        )
          .pipe(toArray())
          .toPromise()
      ).resolves.toEqual([
        clearNewTask(),
        taskCreateFailed("abc", "HTTP Error: Server error (500)")
      ])
    })

    it("indicates success with a new id", async () => {
      await expect(
        newTaskEpic(
          ActionsObservable.of(createNewTask("abc")),
          { getState: () => ({ newTask: { text: "foo" } }) },
          {
            fetchFromAPI: () =>
              Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ item: { _id: "def" } })
              })
          }
        )
          .pipe(toArray())
          .toPromise()
      ).resolves.toEqual([clearNewTask(), taskCreated("abc", "def")])
    })

    it("handles missing id in the response", async () => {
      const consoleError = console.error
      console.error = jest.fn()

      await expect(
        newTaskEpic(
          ActionsObservable.of(createNewTask("abc")),
          { getState: () => ({ newTask: { text: "foo" } }) },
          {
            fetchFromAPI: () =>
              Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ item: {} })
              })
          }
        )
          .pipe(toArray())
          .toPromise()
      ).resolves.toEqual([clearNewTask(), reloadTasks()])

      expect(console.error).toBeCalledWith(
        "Missing '_id' field in the API response"
      )
      expect(console.error).toBeCalledWith(
        "Reloading to get correct task id..."
      )
      console.error = consoleError
    })

    it("handles missing item field in the response", async () => {
      const consoleError = console.error
      console.error = jest.fn()

      await expect(
        newTaskEpic(
          ActionsObservable.of(createNewTask("abc")),
          { getState: () => ({ newTask: { text: "foo" } }) },
          {
            fetchFromAPI: () =>
              Promise.resolve({
                ok: true,
                json: () => Promise.resolve({})
              })
          }
        )
          .pipe(toArray())
          .toPromise()
      ).resolves.toEqual([clearNewTask(), reloadTasks()])

      expect(console.error).toBeCalledWith(
        "Missing 'item' field in the API response"
      )
      expect(console.error).toBeCalledWith(
        "Reloading to get correct task id..."
      )
      console.error = consoleError
    })
  })

  describe("loadTasksEpic", () => {
    // TODO: validate tasks against a schema and give helpful errors when it fails

    it("calls fetch and delay when given a reload action", async () => {
      const fetchFromAPI = jest.fn().mockReturnValue(Promise.resolve())
      const delay = jest.fn().mockReturnValue(Promise.resolve())

      await loadTasksEpic(
        ActionsObservable.of(reloadTasks()),
        { getState: () => ({ tasks: {} }) },
        { fetchFromAPI, delay }
      ).toPromise()

      expect(fetchFromAPI).toBeCalledWith("/tasks?pageToken=")
      expect(delay).toBeCalledWith(500)
    })

    it("doesn't call fetch or delay and sends nothing when already loading", async () => {
      const fetchFromAPI = jest.fn().mockReturnValue(Promise.resolve())
      const delay = jest.fn().mockReturnValue(Promise.resolve())

      await expect(
        loadTasksEpic(
          ActionsObservable.of(reloadTasks()),
          { getState: () => ({ tasks: { status: "LOADING" } }) },
          { fetchFromAPI, delay }
        )
          .pipe(toArray())
          .toPromise()
      ).resolves.toEqual([])

      expect(fetchFromAPI).not.toBeCalled()
      expect(delay).not.toBeCalled()
    })

    it("calls fetch and not delay when given a load page action if tasks are unloaded", async () => {
      const fetchFromAPI = jest.fn().mockReturnValue(Promise.resolve())
      const delay = jest.fn().mockReturnValue(Promise.resolve())

      await loadTasksEpic(
        ActionsObservable.of(loadNextTasks()),
        {
          getState: () => ({
            tasks: { status: "UNLOADED", nextPageToken: null }
          })
        },
        { fetchFromAPI, delay }
      ).toPromise()

      expect(fetchFromAPI).toBeCalledWith("/tasks?pageToken=")
      expect(delay).not.toBeCalled()
    })

    it("does not call fetch or delay when given a load page action if tasks are loaded and there is no next page token", async () => {
      const fetchFromAPI = jest.fn().mockReturnValue(Promise.resolve())
      const delay = jest.fn().mockReturnValue(Promise.resolve())

      await loadTasksEpic(
        ActionsObservable.of(loadNextTasks()),
        {
          getState: () => ({
            tasks: { nextPageToken: null }
          })
        },
        { fetchFromAPI, delay }
      ).toPromise()

      expect(fetchFromAPI).not.toBeCalled()
      expect(delay).not.toBeCalled()
    })

    it("calls fetch and not delay when given a load page action with the next page token", async () => {
      const fetchFromAPI = jest.fn().mockReturnValue(Promise.resolve())
      const delay = jest.fn().mockReturnValue(Promise.resolve())

      await loadTasksEpic(
        ActionsObservable.of(loadNextTasks()),
        {
          getState: () => ({
            tasks: { nextPageToken: "abc" }
          })
        },
        { fetchFromAPI }
      ).toPromise()

      expect(fetchFromAPI).toBeCalledWith("/tasks?pageToken=abc")
      expect(delay).not.toBeCalled()
    })

    it("handles fetch errors gracefully", async () => {
      await expect(
        loadTasksEpic(
          ActionsObservable.of(reloadTasks()),
          { getState: () => ({ tasks: {} }) },
          {
            fetchFromAPI: () => Promise.reject(TypeError("Failed to fetch")),
            delay: () => Promise.resolve()
          }
        )
          .pipe(toArray())
          .toPromise()
      ).resolves.toEqual([
        tasksLoadingStarted(),
        tasksLoadingFailed("Failed to fetch")
      ])
    })

    it("handles http errors gracefully", async () => {
      await expect(
        loadTasksEpic(
          ActionsObservable.of(reloadTasks()),
          { getState: () => ({ tasks: {} }) },
          {
            fetchFromAPI: () =>
              Promise.resolve({
                ok: false,
                status: 500,
                statusText: "Server error"
              }),
            delay: () => Promise.resolve()
          }
        )
          .pipe(toArray())
          .toPromise()
      ).resolves.toEqual([
        tasksLoadingStarted(),
        tasksLoadingFailed("HTTP Error: Server error (500)")
      ])
    })

    it("loads tasks and next page token", async () => {
      await expect(
        loadTasksEpic(
          ActionsObservable.of(reloadTasks()),
          { getState: () => ({ tasks: {} }) },
          {
            fetchFromAPI: () =>
              Promise.resolve({
                ok: true,
                json: () =>
                  Promise.resolve({
                    items: [
                      { _id: "a", isComplete: false, text: "foo" },
                      { _id: "b", isComplete: true, text: "bar" }
                    ],
                    nextPageToken: "abc"
                  })
              }),
            delay: () => Promise.resolve()
          }
        )
          .pipe(toArray())
          .toPromise()
      ).resolves.toEqual([
        tasksLoadingStarted(),
        tasksReceived(
          [
            { _id: "a", isComplete: false, text: "foo" },
            { _id: "b", isComplete: true, text: "bar" }
          ],
          "abc"
        )
      ])
    })

    it("handles empty tasks and null next page token", async () => {
      const consoleError = console.error
      console.error = jest.fn()

      await expect(
        loadTasksEpic(
          ActionsObservable.of(reloadTasks()),
          { getState: () => ({ tasks: {} }) },
          {
            fetchFromAPI: () =>
              Promise.resolve({
                ok: true,
                json: () =>
                  Promise.resolve({
                    items: [],
                    nextPageToken: null
                  })
              }),
            delay: () => Promise.resolve()
          }
        )
          .pipe(toArray())
          .toPromise()
      ).resolves.toEqual([tasksLoadingStarted(), tasksReceived([], null)])

      expect(console.error).not.toBeCalled()
      console.error = consoleError
    })

    it("complains when items is missing in the response", async () => {
      const consoleError = console.error
      console.error = jest.fn()

      await expect(
        loadTasksEpic(
          ActionsObservable.of(reloadTasks()),
          { getState: () => ({ tasks: {} }) },
          {
            fetchFromAPI: () =>
              Promise.resolve({
                ok: true,
                json: () =>
                  Promise.resolve({
                    nextPageToken: null
                  })
              }),
            delay: () => Promise.resolve()
          }
        )
          .pipe(toArray())
          .toPromise()
      ).resolves.toEqual([tasksLoadingStarted(), tasksReceived([], null)])

      expect(console.error).toBeCalledWith(
        "Missing or invalid 'items' field in the API response"
      )
      console.error = consoleError
    })

    it("complains when items is not an array in the response", async () => {
      const consoleError = console.error
      console.error = jest.fn()

      await expect(
        loadTasksEpic(
          ActionsObservable.of(reloadTasks()),
          { getState: () => ({ tasks: {} }) },
          {
            fetchFromAPI: () =>
              Promise.resolve({
                ok: true,
                json: () =>
                  Promise.resolve({
                    items: "foo",
                    nextPageToken: null
                  })
              }),
            delay: () => Promise.resolve()
          }
        )
          .pipe(toArray())
          .toPromise()
      ).resolves.toEqual([tasksLoadingStarted(), tasksReceived([], null)])

      expect(console.error).toBeCalledWith(
        "Missing or invalid 'items' field in the API response"
      )
      console.error = consoleError
    })

    it("complains when nextPageToken is missing, but still shows items", async () => {
      const consoleError = console.error
      console.error = jest.fn()

      await expect(
        loadTasksEpic(
          ActionsObservable.of(reloadTasks()),
          { getState: () => ({ tasks: {} }) },
          {
            fetchFromAPI: () =>
              Promise.resolve({
                ok: true,
                json: () =>
                  Promise.resolve({
                    items: [
                      { _id: "a", isComplete: false, text: "foo" },
                      { _id: "b", isComplete: true, text: "bar" }
                    ]
                  })
              }),
            delay: () => Promise.resolve()
          }
        )
          .pipe(toArray())
          .toPromise()
      ).resolves.toEqual([
        tasksLoadingStarted(),
        tasksReceived(
          [
            { _id: "a", isComplete: false, text: "foo" },
            { _id: "b", isComplete: true, text: "bar" }
          ],
          null
        )
      ])

      expect(console.error).toBeCalledWith(
        "Missing 'nextPageToken' field in the API response"
      )
      console.error = consoleError
    })
  })

  describe("editTaskEpic", () => {
    it("calls fetch when it gets an edit action", async () => {
      const fetchFromAPI = jest.fn().mockReturnValue(Promise.resolve())

      await editTaskEpic(
        ActionsObservable.of(
          editTask(
            "a",
            { isComplete: true, text: "foo" },
            { isComplete: false, text: "bar" }
          )
        ),
        {},
        { fetchFromAPI }
      ).toPromise()

      expect(fetchFromAPI).toBeCalledWith("/tasks/a", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ isComplete: true, text: "foo" })
      })
    })

    it("handles fetch errors gracefully", async () => {
      await expect(
        editTaskEpic(
          ActionsObservable.of(
            editTask(
              "a",
              { isComplete: true, text: "foo" },
              { isComplete: false, text: "bar" }
            )
          ),
          {},
          { fetchFromAPI: () => Promise.reject(TypeError("Failed to fetch")) }
        )
          .pipe(toArray())
          .toPromise()
      ).resolves.toEqual([
        taskEditFailed(
          "a",
          { isComplete: false, text: "bar" },
          "Failed to fetch"
        )
      ])
    })

    it("handles http errors gracefully", async () => {
      await expect(
        editTaskEpic(
          ActionsObservable.of(
            editTask(
              "a",
              { isComplete: true, text: "foo" },
              { isComplete: false, text: "bar" }
            )
          ),
          {},
          {
            fetchFromAPI: () =>
              Promise.resolve({
                ok: false,
                status: 500,
                statusText: "Server error"
              })
          }
        )
          .pipe(toArray())
          .toPromise()
      ).resolves.toEqual([
        taskEditFailed(
          "a",
          { isComplete: false, text: "bar" },
          "HTTP Error: Server error (500)"
        )
      ])
    })

    it("indicates success when the request goes through", async () => {
      await expect(
        editTaskEpic(
          ActionsObservable.of(
            editTask(
              "a",
              { isComplete: true, text: "foo" },
              { isComplete: false, text: "bar" }
            )
          ),
          {},
          { fetchFromAPI: () => Promise.resolve({ ok: true }) }
        )
          .pipe(toArray())
          .toPromise()
      ).resolves.toEqual([taskEditSucceeded("a")])
    })
  })

  describe("deleteTaskEpic", () => {
    it("calls fetch when it gets a delete action", async () => {
      const fetchFromAPI = jest.fn().mockReturnValue(Promise.resolve())

      await deleteTaskEpic(
        ActionsObservable.of(deleteTask("a")),
        {},
        { fetchFromAPI }
      ).toPromise()

      expect(fetchFromAPI).toBeCalledWith("/tasks/a", {
        method: "DELETE"
      })
    })

    it("does nothing when it gets a delete action with a temp id", async () => {
      const fetchFromAPI = jest.fn().mockReturnValue(Promise.resolve())

      await expect(
        deleteTaskEpic(
          ActionsObservable.of(deleteTask(getTempTaskId())),
          {},
          { fetchFromAPI }
        )
          .pipe(toArray())
          .toPromise()
      ).resolves.toEqual([])

      expect(fetchFromAPI).not.toBeCalled()
    })

    it("handles fetch errors gracefully", async () => {
      await expect(
        deleteTaskEpic(
          ActionsObservable.of(
            deleteTask("a", { isComplete: true, text: "foo" })
          ),
          {},
          { fetchFromAPI: () => Promise.reject(TypeError("Failed to fetch")) }
        )
          .pipe(toArray())
          .toPromise()
      ).resolves.toEqual([
        taskDeleteFailed(
          "a",
          { isComplete: true, text: "foo" },
          "Failed to fetch"
        )
      ])
    })

    it("handles http errors gracefully", async () => {
      await expect(
        deleteTaskEpic(
          ActionsObservable.of(
            deleteTask("a", { isComplete: true, text: "foo" })
          ),
          {},
          {
            fetchFromAPI: () =>
              Promise.resolve({
                ok: false,
                status: 500,
                statusText: "Server error"
              })
          }
        )
          .pipe(toArray())
          .toPromise()
      ).resolves.toEqual([
        taskDeleteFailed(
          "a",
          { isComplete: true, text: "foo" },
          "HTTP Error: Server error (500)"
        )
      ])
    })

    it("indicates success when the request goes through", async () => {
      await expect(
        deleteTaskEpic(
          ActionsObservable.of(
            deleteTask("a", { isComplete: true, text: "foo" })
          ),
          {},
          { fetchFromAPI: () => Promise.resolve({ ok: true }) }
        )
          .pipe(toArray())
          .toPromise()
      ).resolves.toEqual([taskDeleteSucceeded("a")])
    })
  })
})
