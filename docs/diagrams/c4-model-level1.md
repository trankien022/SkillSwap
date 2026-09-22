+------------------+
|     Learner      |
|  Student user    |
+--------+---------+
         |
         | Search, book, pay,
         | attend, review
         v
+------------------------------------------------------+
|                  SkillSwap System                    |
|------------------------------------------------------|
| Student skill marketplace for verified learners      |
| and verified student teachers                        |
|                                                      |                 +-------------------+  
| - Account & authentication                           |  transaction    |  Payment Gateway  |
| - Student verification                               |───────────────> |  External System  |
| - Teacher skill verification                         |                 +-------------------+
| - Class marketplace                                  |
| - Booking                                            |
| - Credit wallet                                      |                 +-------------------+
| - Chat                                               |  online class   |       Jitsi       |
| - Rating / review                                    |───────────────> |  External System  |
| - Online classroom access                            |                 +-------------------+
+------------------------------------------------------+
      ^                ^                ^
      |                |                |
      |                |                |
+-----+------+   +-----+------+   +-----+-----------+
|  Teacher   |   |  Verifier  |   | Administrator   |
|            |   |            |   |                 |
| Submit     |   | Review     |   | Verify students |
| evidence   |   | teacher    |   | Manage verifier |
| Create     |   | skills     |   | Handle ops      |
| classes    |   +------------+   +-----------------+
| Teach      |
| Withdraw   |
+------------+

