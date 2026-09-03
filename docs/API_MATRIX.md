# CampusX API Matrix

| Domain        | Routes                                                                                      | Real-time events                             |
| ------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Auth          | `POST /auth/signup`, `/login`, `/refresh`, `/logout`, `/forgot-password`, `/reset-password` | —                                            |
| Users         | `GET/PATCH /users/me`, `GET /users/:id`, `GET /users/search`                                | `user:online`, `user:offline`                |
| Friends       | requests, accept/reject, list, suggestions, mutual                                          | `friend:request`, `friend:accepted`          |
| Posts         | feed, create, detail, delete, reactions, save                                               | `notification:new`                           |
| Stories       | list, create, view                                                                          | —                                            |
| Chats         | conversations, messages, read state                                                         | `message:new`, `message:read`, typing events |
| Groups        | groups, members, polls/votes, files, sessions                                               | `group:update`, `poll:update`                |
| Events        | list, detail, create/update, attendance                                                     | `notification:new`                           |
| Marketplace   | list, detail, CRUD, sold state                                                              | `notification:new`                           |
| Timetable     | list, create, update, delete                                                                | —                                            |
| Trips         | CRUD, members, invitations, itinerary, votes, expenses                                      | `trip:update`, `notification:new`            |
| Notifications | list, unread count, read/read-all                                                           | `notification:new`                           |
| Location      | current sharing state, update, visible friends                                              | `location:update`                            |
| AI            | chat, history, tools                                                                        | `ai:chunk` optional                          |

All responses follow `{ success, data, message }`. Authentication, validation, ownership checks, pagination, and centralized errors apply across modules.
