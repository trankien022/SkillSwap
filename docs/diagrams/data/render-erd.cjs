// Render the authoritative DBML with readable routing and focused domain views.
// Dependencies are tooling only; see README.md for the regeneration command.
const fs = require('node:fs');
const path = require('node:path');
const { parse } = require('@softwaretechnik/dbml-renderer/lib/parser');
const { check } = require('@softwaretechnik/dbml-renderer/lib/checker');
const sharp = require('sharp');
// Resolve the CJS entry directly to support Node versions with ESM require().
const vizRoot = path.dirname(path.dirname(require.resolve('@aduh95/viz.js/sync')));
const viz = require(path.join(vizRoot, 'dist/render_sync.cjs'));

const domains = {
  identity: {
    label: '01 · Identity & student verification', color: '#1D4ED8',
    tables: ['users', 'user_roles', 'schools', 'majors', 'school_majors',
      'profiles', 'student_verifications', 'audit_events', 'notifications'],
  },
  skills: {
    label: '02 · Skills & evidence', color: '#7C3AED',
    tables: ['users', 'profiles', 'skills', 'profile_skills', 'skill_evidence'],
  },
  learning: {
    label: '03 · Classes, bookings & interaction', color: '#047857',
    tables: ['users', 'skills', 'classes', 'class_skills', 'bookings', 'messages', 'ratings'],
  },
  finance: {
    label: '04 · Wallets, ledger & withdrawal', color: '#B45309',
    tables: ['users', 'classes', 'bookings', 'wallets', 'ledger_transactions',
      'ledger_postings', 'withdrawal_requests', 'gateway_events'],
  },
};
const canonicalNames = {
  User: 'users', UserRole: 'user_roles', School: 'schools', Major: 'majors',
  SchoolMajor: 'school_majors', Profile: 'profiles', StudentVerification: 'student_verifications',
  Skill: 'skills', ProfileSkill: 'profile_skills', SkillEvidence: 'skill_evidence',
  Class: 'classes', ClassSkill: 'class_skills', Booking: 'bookings', Message: 'messages',
  Rating: 'ratings', Wallet: 'wallets', LedgerTransaction: 'ledger_transactions',
  LedgerPosting: 'ledger_postings', WithdrawalRequest: 'withdrawal_requests',
};
const canonical = name => canonicalNames[name] || name;
const domainOf = name => {
  name = canonical(name);
  return Object.values(domains).find(domain => domain.tables.includes(name)) || domains.identity;
};
const escapeXml = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const endpoint = value => `${value.name}.${value.columns.join(', ')}`;

const has = (settings, key) => Object.hasOwn(settings || {}, key);
const sameColumns = (a, b) => a.length === b.length && a.every(value => b.includes(value));
const indexes = table => table.actual.items.find(item => item.type === 'indices')?.indices || [];
const primaryKey = table => [
  ...table.columns.filter(column => has(column.settings, 'pk')).map(column => column.name),
  ...indexes(table).filter(index => has(index.settings, 'pk')).flatMap(index => index.columns),
];
const uniqueKeys = table => [
  ...table.columns.filter(column => has(column.settings, 'unique')).map(column => [column.name]),
  ...indexes(table).filter(index => has(index.settings, 'unique')).map(index => index.columns),
];
const isUnique = (table, columns) => [primaryKey(table), ...uniqueKeys(table)]
  .some(key => sameColumns(key, columns));
const required = (table, columns) => columns.every(name => {
  const column = table.columns.find(value => value.name === name);
  return has(column.settings, 'not null') || primaryKey(table).includes(name);
});

function relationship(ref) {
  const relation = ref.actual;
  let childSide;
  if (relation.cardinality === '>') childSide = 'from';
  else if (relation.cardinality === '<') childSide = 'to';
  else if (relation.cardinality === '-') {
    // A one-to-one declaration can start at either the PK or the unique FK.
    childSide = sameColumns(primaryKey(ref.from.table), relation.from.columns) ? 'to' : 'from';
  } else throw new Error('Use a junction table for many-to-many relationships');
  const parentSide = childSide === 'from' ? 'to' : 'from';
  const child = ref[childSide].table;
  const parent = ref[parentSide].table;
  const foreignColumns = relation[childSide].columns;
  const oneChild = isUnique(child, foreignColumns);
  if ((relation.cardinality === '-') !== oneChild) {
    throw new Error(`Declared cardinality disagrees with unique keys: ${endpoint(relation[childSide])}`);
  }
  // Minimum children cannot be inferred from FK NOT NULL. Most parents may have none.
  // These two minima come from the existing atomic-creation business rules.
  const childMinimum = (canonical(parent.actual.name) === 'users' && canonical(child.actual.name) === 'profiles')
    || (canonical(parent.actual.name) === 'withdrawal_requests' && canonical(child.actual.name) === 'ledger_transactions') ? 1 : 0;
  const cardinalities = {};
  cardinalities[parentSide] = { min: required(child, foreignColumns) ? 1 : 0, max: '1' };
  cardinalities[childSide] = { min: childMinimum, max: oneChild ? '1' : 'N' };
  return {
    childSide, parentSide, child, foreignColumns, ...cardinalities,
    identifying: foreignColumns.every(name => primaryKey(child).includes(name)),
  };
}

const range = cardinality => `${cardinality.min}..${cardinality.max}`;
// Graphviz draws the first primitive closest to the entity: maximum, then minimum.
const marker = cardinality => `${cardinality.max === 'N' ? 'crow' : 'tee'}${cardinality.min === 0 ? 'odot' : 'tee'}`;
const visualNotes = {
  profiles: ['Exactly 1 Profile per User; create atomically.'],
  classes: ['Draft: 0..N ClassSkills; published: at least 1.', 'Completion actor may be NULL for system completion.'],
  bookings: ['Confirmed: booking transfer required.', 'At most 1 full release operation per Booking.'],
  wallets: ['User has 0..1 Wallet; system Wallet has no User.'],
  ledger_transactions: ['Unposted: 0..N postings; posted/reversed: at least 2, sum = 0.',
    'Full reversal: exactly 1 original; original has 0..1 full reversal.',
    'Original ID is NULL for every other transaction kind.'],
  withdrawal_requests: ['Every saved request has a posted hold (at least 1 transaction).'],
  student_verifications: ['Partial UQ: at most 1 Approved per Profile.', 'Reviewer required on approval; may be NULL before review.'],
  skill_evidence: ['Partial UQ: at most 1 Approved per ProfileSkill.', 'Approval requires reviewer, approved level and decision time.'],
};

function tableDot(table, allRefs) {
  const name = table.actual.name;
  const pk = primaryKey(table);
  const uq = uniqueKeys(table);
  const foreign = new Set();
  const composite = [];
  for (const ref of allRefs) {
    const relation = relationship(ref);
    if (relation.child.actual.name === name) relation.foreignColumns.forEach(column => foreign.add(column));
    for (const side of ['from', 'to']) {
      if (ref.actual[side].name === name && ref.actual[side].columns.length > 1
        && !composite.some(columns => sameColumns(columns, ref.actual[side].columns))) {
        composite.push(ref.actual[side].columns);
      }
    }
  }
  const rows = table.columns.map((column, index) => {
    const keys = [];
    if (pk.includes(column.name)) keys.push('PK');
    if (foreign.has(column.name)) keys.push('FK');
    uq.forEach((columns, group) => { if (columns.includes(column.name)) keys.push(`UQ${group + 1}`); });
    const nullable = required(table, [column.name]) ? ' (!)' : '';
    const label = pk.includes(column.name) ? `<B>${escapeXml(column.name)}</B>` : escapeXml(column.name);
    return `<TR><TD PORT="f${index + 1}" ALIGN="LEFT"><TABLE BORDER="0" CELLBORDER="0" CELLPADDING="0"><TR>`
      + `<TD ALIGN="LEFT">${label}</TD><TD WIDTH="18"></TD>`
      + `<TD ALIGN="RIGHT"><I>${escapeXml(column.data + nullable)}</I></TD><TD WIDTH="14"></TD>`
      + `<TD ALIGN="RIGHT"><FONT POINT-SIZE="12" COLOR="#475569">${keys.join(', ') || '&#160;'}</FONT></TD></TR></TABLE></TD></TR>`;
  });
  composite.forEach((columns, index) => {
    const foreignGroup = allRefs.some(ref => {
      const relation = relationship(ref);
      return relation.child.actual.name === name && sameColumns(relation.foreignColumns, columns);
    });
    const keyLabel = sameColumns(pk, columns) ? 'PK' : foreignGroup ? 'FK' : 'KEY';
    rows.push(`<TR><TD PORT="c${index}" ALIGN="LEFT" BGCOLOR="#EFF6FF"><FONT POINT-SIZE="14">`
      + `${keyLabel}: (${escapeXml(columns.join(', '))})</FONT></TD></TR>`);
  });
  const constraints = [];
  if (pk.length > 1) constraints.push(`PK: (${pk.join(', ')})`);
  uq.forEach((columns, index) => constraints.push(`UQ${index + 1}: (${columns.join(', ')})`));
  for (const text of [...constraints, ...(visualNotes[canonical(name)] || [])]) {
    rows.push(`<TR><TD ALIGN="LEFT" BGCOLOR="#F8FAFC"><FONT POINT-SIZE="13" COLOR="#334155">${escapeXml(text)}</FONT></TD></TR>`);
  }
  return `"${name}" [id="${name}", label=<<TABLE BORDER="1" CELLBORDER="1" CELLSPACING="0" CELLPADDING="8" COLOR="#64748B">`
    + `<TR><TD PORT="header" BGCOLOR="${domainOf(name).color}"><FONT COLOR="white"><B>${escapeXml(name)}</B></FONT></TD></TR>`
    + rows.join('\n') + '</TABLE>>];';
}

function port(table, columns, allRefs) {
  if (columns.length === 1) return `f${table.columns.findIndex(column => column.name === columns[0]) + 1}`;
  const groups = [];
  for (const ref of allRefs) for (const side of ['from', 'to']) {
    const end = ref.actual[side];
    if (end.name === table.actual.name && end.columns.length > 1
      && !groups.some(value => sameColumns(value, end.columns))) groups.push(end.columns);
  }
  return `c${groups.findIndex(value => sameColumns(value, columns))}`;
}

function focused(model, domain) {
  const names = new Set(domain.tables);
  const tables = model.ungroupedTables.filter(table => names.has(table.actual.name));
  const types = new Set(tables.flatMap(table => table.columns.map(column => column.data)));
  return {
    ...model,
    allRefs: model.refs,
    ungroupedTables: tables,
    enums: model.enums.filter(value => types.has(value.actual.name)),
    refs: model.refs.filter(ref => names.has(ref.actual.from.name) && names.has(ref.actual.to.name)),
  };
}

async function exportView(model, stem, label) {
  const allRefs = model.allRefs || model.refs;
  const legend = 'Crow’s Foot: circle = 0; bar = 1; fork = N. Solid = identifying; dashed = non-identifying. PK / FK / UQn = key labels; (!) = NOT NULL.';
  const nodes = model.ungroupedTables.map(table => tableDot(table, allRefs));
  for (const type of model.enums) {
    nodes.push(`"enum-${type.actual.name}" [id="enum-${type.actual.name}", label=<<TABLE BORDER="1" CELLBORDER="0" CELLSPACING="0" CELLPADDING="8"><TR><TD BGCOLOR="#475569"><FONT COLOR="white">ENUM: ${escapeXml(type.actual.name)}</FONT></TD></TR>`
      + type.values.map(value => `<TR><TD>${escapeXml(value)}</TD></TR>`).join('') + '</TABLE>>];');
  }
  const edges = model.refs.map((ref, index) => {
    const info = relationship(ref);
    const from = `"${ref.actual.from.name}":${port(ref.from.table, ref.actual.from.columns, allRefs)}:e`;
    const to = `"${ref.actual.to.name}":${port(ref.to.table, ref.actual.to.columns, allRefs)}:w`;
    return `${from} -> ${to} [id="relation-${index}", dir=both, arrowtail="${marker(info.from)}", arrowhead="${marker(info.to)}",`
      + ` style="${info.identifying ? 'solid' : 'dashed'}", color="${domainOf(info.child.actual.name).color}", penwidth=2, arrowsize=1.3];`;
  });
  const dot = `digraph dbml { graph [rankdir=LR, splines=polyline, nodesep=0.6, ranksep=1.3, pad=0.4, bgcolor="white", fontname="Arial", fontsize=22, labelloc=t, labeljust=l,`
    + ` label=<<B>${escapeXml(label)}</B><BR/><FONT POINT-SIZE="13">${escapeXml(legend)}</FONT>>];`
    + 'node [shape=plain, fontname="Arial", fontsize=18]; edge [fontname="Arial", fontsize=14];\n'
    + nodes.join('\n') + '\n' + edges.join('\n') + '\n}';
  let svg = viz(dot, { engine: 'dot', format: 'svg' });
  // White underlays separate crossings; endpoint labels remain visible on top.
  svg = svg.replace(/(<g id="relation(?:-|&#45;)(\d+)" class="edge">)([\s\S]*?)(<\/g>)/g,
    (match, open, number, body, close) => {
      const ref = model.refs[Number(number)].actual;
      const info = relationship(model.refs[Number(number)]);
      const title = escapeXml(`${endpoint(ref.from)} [${range(info.from)}] — ${endpoint(ref.to)} [${range(info.to)}]; ${info.identifying ? 'identifying' : 'non-identifying'}`);
      open = open.replace('class="edge"', `class="edge" data-from="${escapeXml(endpoint(ref.from))}" data-to="${escapeXml(endpoint(ref.to))}" data-from-cardinality="${range(info.from)}" data-to-cardinality="${range(info.to)}"`);
      body = body.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`);
      body = body.replace(/<path\b[^>]*\/>/g, line => {
        const underlay = line.replace(/stroke="[^"]*"/, 'stroke="white"')
          .replace(/stroke-width="[^"]*"/, 'stroke-width="7"').replace(/stroke-dasharray="[^"]*"/, '');
        return underlay + line;
      });
      return open + body + close;
    });
  svg = svg.replace(/(<svg\b[^>]*>)/, '$1\n<style>\n'
    + '.edge text { paint-order: stroke; stroke: white; stroke-width: 4px; stroke-linejoin: round; }\n'
    + '.edge:hover path:not([stroke="white"]) { stroke: #DC2626; stroke-width: 4; }\n'
    + '.edge:hover polygon { stroke: #DC2626; fill: #DC2626; }\n'
    + '.edge:hover ellipse, .edge:hover polyline { stroke: #DC2626; }\n'
    + '.edge:hover text { fill: #DC2626; font-weight: bold; }\n'
    + '</style>');
  fs.writeFileSync(path.join(__dirname, `${stem}.svg`), svg);
  await sharp(Buffer.from(svg), { limitInputPixels: false }).flatten({ background: 'white' })
    .png().toFile(path.join(__dirname, `${stem}.png`));
  console.log(`${stem}: ${model.ungroupedTables.length} tables, ${model.refs.length} relations`);
}

async function main() {
  const models = {};
  for (const kind of ['conceptual', 'logical']) {
    const model = check(parse(fs.readFileSync(path.join(__dirname, `skillswap-${kind}.dbml`), 'utf8')));
    models[kind] = model;
    await exportView(model, `skillswap-${kind}`, `SkillSwap · ${kind} · complete model`);
  }
  // Every logical FK must appear in at least one focused view.
  const views = Object.entries(domains).map(([name, domain]) => ({ name, domain, model: focused(models.logical, domain) }));
  const covered = new Set(views.flatMap(view => view.model.refs));
  if (covered.size !== models.logical.refs.length) throw new Error('A logical relation is missing from the focused views');
  for (const view of views) {
    await exportView(view.model, `skillswap-logical-${view.name}`, `SkillSwap · ${view.domain.label}`);
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
