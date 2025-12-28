/**
 * Test Date Filter Logic
 */

// Simulate the date filter logic
const testDateFilter = () => {
  // Simulate queries with different dates
  const queries = [
    { createdAt: new Date('2025-12-28T00:10:11.000Z') },
    { createdAt: new Date('2025-12-28T00:49:49.000Z') },
    { createdAt: new Date('2025-12-28T00:50:17.000Z') },
    { createdAt: new Date('2025-12-27T21:03:33.000Z') },
    { createdAt: new Date('2025-12-26T03:58:11.000Z') },
    { createdAt: new Date('2025-12-25T09:25:32.000Z') },
  ];

  console.log('All queries:', queries.length);
  queries.forEach(q => console.log('  ', q.createdAt.toISOString()));

  // Test with date range filter (like from HAR file: startDate=2025-11-28&endDate=2025-12-28)
  const dateFilter = {
    start: new Date('2025-11-28'),
    end: new Date('2025-12-28')
  };
  dateFilter.end.setHours(23, 59, 59, 999);

  console.log('\nDate filter:', {
    start: dateFilter.start.toISOString(),
    end: dateFilter.end.toISOString()
  });

  const filterByDate = <T extends { createdAt: Date | string }>(items: T[]): T[] => {
    if (!dateFilter.start && !dateFilter.end) return items;
    return items.filter(item => {
      const itemDate = new Date(item.createdAt);
      if (dateFilter.start && itemDate < dateFilter.start) return false;
      if (dateFilter.end && itemDate > dateFilter.end) return false;
      return true;
    });
  };

  const filtered = filterByDate(queries);
  console.log('\nFiltered queries:', filtered.length);
  filtered.forEach(q => console.log('  ', q.createdAt.toISOString()));

  // Test with no date filter
  console.log('\n--- No date filter ---');
  const noFilter = filterByDate.call(null, queries);
  console.log('Result:', noFilter.length);
};

testDateFilter();

