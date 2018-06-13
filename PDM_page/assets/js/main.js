$(function() {
	//On page load
	var page = document.URL.split('#')[1];
	if (page == undefined) { page = 'itemCheckout'; }

	$('a[data-toggle="tab"]').parent().removeClass('active');
	$('a[href="#' + page + '"]').parent().addClass('active');

	$.get('pages/' + page + '.php', function(response) {
		$('.tab-content').html(response);
	});

	//Login form
	$(document).on('submit', '#loginForm', function() {
		var data = $(this).serialize();
		$('#loginButton').html('<i class="fa fa-refresh fa-spin"></i> Loading...');

		$.post('ajax/login.php', data, function(response) {
			$('#loginResponse').html(response);
			$('#loginButton').html('Login');
			$('#loginForm')[0].reset();
		});

		return false;
	});

	//Page switching
	$(document).on('click', 'a[data-toggle="tab"]', function() {
		page = $(this).attr('href').replace('#', '');
		$('.tab-content').html('<center><i class="fa fa-refresh fa-5x fa-spin"></i><br /><h4>Loading...</h4></center>');

		$.get('pages/' + page + '.php', function(response) {
			$('.tab-content').html(response);
		});
	});

	//Item Checkout
	$(document).on('submit', '#newCheckout', function() {
		$('#newCheckoutButton').html('<i class="fa fa-refresh fa-spin"></i> Loading...');

		var data = $(this).serialize();
		$.post('ajax/itemCheckout.php?newCheckout', data, function(response) {
			$('#newCheckoutButton').html('Request Checkout');

			if ($.isNumeric(response)) {
				if ($('#noCheckoutsRow').length == 1) {
    				$('#noCheckoutsRow').remove();
    			}

    			$('#yourCheckouts tr:first').after('<tr><td>' + $('select[name="item"] option:selected').text() + '</td><td><font color="blue">Pending</font></td><td><button id="' + response + '" class="btn btn-primary cancelCheckout">Cancel</button></td></tr>');

    			$('#newCheckout')[0].reset();
    			$('#newCheckoutResponse').html('<font color="green"><i class="fa fa-thumbs-up"></i> Your request has been received.</font>');
			} else {
				$('#newCheckoutResponse').html(response);
			}
		});

		return false;
	});

	$(document).on('click', '.cancelCheckout', function() {
		var id = $(this).attr('id');

		var data = 'id=' + id;
		$.post('ajax/itemCheckout.php?cancelCheckout', data, function(response) {
			
		});
	});

	/*$(document).on('click', '.returnCheckout', function() {
		FINISH THIS
	});*/

	$(document).on('click', '.teamSort', function() {
		var team = $(this).html();

		$('.member').hide();
		switch(team) {
			case 'All':
				$('.member').show();
				break;

			case 'Software':
				$('div[subsystem="1"]').show();
				break;

			case 'Business':
				$('div[subsystem="2"]').show();
				break;

			case 'Aeromechanical':
				$('div[subsystem="3"]').show();
				break;

			case 'Electrical':
				$('div[subsystem="4"]').show();
				break;
		}
	});

});