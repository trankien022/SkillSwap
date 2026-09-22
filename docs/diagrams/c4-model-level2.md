             Learner [Person]                 Teacher [Person]
                    |                                |
                    |                                |
                    v                                v
        +----------------------------------------------------------+
        |                                                          |
        |                    SKILLSWAP SYSTEM                      |
        |                                                          |
        |   +-------------------+                                  |
        |   |   Web Application |                                  |<─────── Verifier [Person]
        |   |    [Container]    |                                  | 
        |   +---------+---------+                                  |
        |             |                                            |
        |             v                                            |
        |   +---------------------------+                          |<─────── Admin [Person]
        |   |        Backend API        |                          |
        |   |        [Container]        |                          |
        |   +------+---------------+----+                          |
        |          |               |                               |
        |          | SQL           | HTTPS                         |
        |          v               |                               |
        |   +--------------+       |                               |
        |   |  PostgreSQL  |       |                               |
        |   |  [Container] |       |                               |
        |   +--------------+       |                               |
        |                           \                              |
        +----------------------------\-----------------------------+
                                      |
                                      |
                           +----------+----------+
                           |                     |
                           v                     v
                     Payment Gateway            Jitsi
                    [External System]     [External System]
