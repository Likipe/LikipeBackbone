var LikipeBackbone = (function(LikipeBackbone) {
	
	var timezoneOffset = (new Date()).getTimezoneOffset() * 60000;
	
	/**
	 * Converts a newly created Date object from local time to UTC time.
	 * 
	 * @param  Date
	 * @return Date  copy
	 */
	var toUTCDate = LikipeBackbone.toUTCDate = function(date) {
		return new Date(date.getTime() + timezoneOffset);
	};
	/**
	 * Converts UTC time date object into a local time date object.
	 * 
	 * @param  Date
	 * @return Date  copy
	 */
	var fromUTCDate = LikipeBackbone.fromUTCDate = function(date) {
		return new Date(date.getTime() - timezoneOffset);
	};
	/**
	 * Returns true if the parameter can be interpreted as a number.
	 */
	var isNumeric = LikipeBackbone.isNumeric = function(n) {
		return ! isNaN(parseFloat(n)) && isFinite(n);
	};
	/**
	 * Parses a MySQL DATETIME formatted string (YYYY-MM-DD HH:ii:ss) into a
	 * javascript Date object. If the formatting fails it returns a new Date
	 * object.
	 * 
	 * TODO: Error handling
	 * TODO: Return false or throw exception on failure?
	 */
	var parseDateTime = LikipeBackbone.parseDateTime = function(datetime) {
		var t = datetime.split(/[- :]/);
	
		if(t.length != 6) {
			return new Date();
		}
	
		return fromUTCDate(new Date(t[0], t[1] - 1, t[2], t[3], t[4], t[5]));
	};
	/**
	 * Returns a new Date instance which contains the difference between the
	 * two suppied MySQL DATETIME formatted strings (YYYY-MM-DD HH:ii:ss).
	 * 
	 * return.getTime() = date2.getTime() - date1.getTime()
	 * 
	 * TODO: Error handling, currently just lets the dates default to
	 *       new Date if the parsing fails or if the parameters are falsy
	 */
	var dateDiff = LikipeBackbone.dateDiff = function(date1, date2) {
		var start = date1 ? parseDateTime(date1).getTime() : (new Date).getTime();
		var end   = date2 ? parseDateTime(date2).getTime() : (new Date).getTime();
	
		return new Date((end - start) | 0);
	};
	
	return LikipeBackbone;
})(LikipeBackbone || {});