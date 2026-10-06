     Learner [Person]              Teacher [Person]
            |  \                       |  /
            |   \                      | /
            v    v                     v
  +--------------------------------------------------------------+
  |                    SKILLSWAP SYSTEM                          |
  |                                                              |
  |   +-------------------+      +----------------------------+   |
  |   |  Web Application  |      |  Mobile Application        |   |
  |   |    [Container]    |      |  [Container] (ADR-015)     |   |
  |   +---------+---------+      +-------------+--------------+   |
  |             | HTTPS                         | HTTPS           |
  |             +-------------+   +-------------+                |
  |                           v   v                               |
  |                     +-------------------+                     |<────── Verifier [Person]
  |                     |     Gateway       |                     |
  |                     |    [Container]    |                     |<────── Admin [Person]
  |                     +---------+---------+                     |
  |                               | REST/JSON                     |
  |                               v                               |
  |                     +-------------------+                     |
  |                     |    Backend API    |                     |
  |                     |    [Container]    |                     |
  |                     +---+-----------+---+                     |
  |                         |           |                         |
  |               SQL       |           |       AMQP (outbox)     |
  |                         v           v                         |
  |              +--------------+   +------------------+          |
  |              |  PostgreSQL  |   |     RabbitMQ     |          |
  |              |  [Container] |   |   [Container]    |          |
  |              +--------------+   +------------------+          |
  |                                                              |
  +-----------------------------+--------------------------------+
                                | HTTPS
                                |
                      +---------+----------+
                      |                    |
                      v                    v
                Payment Gateway            Jitsi
               [External System]     [External System]
